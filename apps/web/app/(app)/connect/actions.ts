"use server";

import {
  API_TOKEN_ACCESS,
  ApiTokenAccess,
  InvalidStateError,
  MAX_ACTIVE_API_TOKENS,
  type ApiTokenScope,
} from "@sintr/core";
import { revalidatePath } from "next/cache";
import { getMessages } from "@/lib/server/language";
import { requireScope } from "@/lib/server/runtime";

export interface MakeKeyState {
  /** The key itself: in this answer only, never stored, never shown again. */
  key: { id: string; token: string; name: string; access: ApiTokenAccess } | null;
  /** What is missing, by field. */
  problems: { name?: string; access?: string };
  /** What went wrong with the key as a whole (too many keys). */
  failure: string | null;
  /** What was sent, so a form that comes back with a problem keeps it (without JavaScript too). */
  values: { name: string; access: ApiTokenAccess | null };
}

/**
 * Make a connection key from what the person decided: a name and what it
 * may do, both asked for, neither chosen for them. Only a hash is stored;
 * the key goes back to the person in this answer and nowhere else. The
 * audit records that a key was made and what it may do, never the key.
 */
export async function makeKey(_state: MakeKeyState, form: FormData): Promise<MakeKeyState> {
  const { scope } = await requireScope();
  const t = await getMessages();
  const rawName = form.get("name");
  const name = (typeof rawName === "string" ? rawName.trim() : "").slice(0, 80);
  const access = ApiTokenAccess.safeParse(form.get("access"));
  const values = { name, access: access.success ? access.data : null };
  const problems = {
    ...(name ? {} : { name: t.connect.problems.name }),
    ...(access.success ? {} : { access: t.connect.problems.access }),
  };
  if (!access.success || !name) return { key: null, problems, failure: null, values };
  try {
    const made = await scope.transaction(async (tx) => {
      const created = await tx.apiTokens.create({
        name,
        scopes: [...API_TOKEN_ACCESS[access.data]] as ApiTokenScope[],
      });
      await tx.auditLog.record({
        action: "api_token.created",
        targetType: "api_token",
        targetId: created.apiToken.id,
        metadata: { access: access.data },
      });
      return created;
    });
    revalidatePath("/connect");
    revalidatePath("/settings");
    return {
      key: { id: made.apiToken.id, token: made.token, name: made.apiToken.name, access: access.data },
      problems: {},
      failure: null,
      // The next key starts from nothing: no name, and no access chosen for the person.
      values: { name: "", access: null },
    };
  } catch (error) {
    if (error instanceof InvalidStateError) {
      return { key: null, problems: {}, failure: t.connect.problems.tooMany(MAX_ACTIVE_API_TOKENS), values };
    }
    throw error;
  }
}

/** Switch a key off at once. What its assistant saved stays in the diary. */
export async function disconnectKey(id: string): Promise<void> {
  const { scope } = await requireScope();
  await scope.transaction(async (tx) => {
    if (await tx.apiTokens.revoke(id)) {
      await tx.auditLog.record({ action: "api_token.revoked", targetType: "api_token", targetId: id });
    }
  });
  revalidatePath("/connect");
  revalidatePath("/settings");
}
