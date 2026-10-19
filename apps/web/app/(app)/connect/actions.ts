"use server";

import {
  API_TOKEN_ACCESS,
  ApiTokenAccess,
  InvalidStateError,
  MAX_ACTIVE_API_TOKENS,
  type ApiTokenScope,
  type UserScope,
} from "@sintr/core";
import { revalidatePath } from "next/cache";
import { getMessages } from "@/lib/server/language";
import { requireScope } from "@/lib/server/runtime";

export interface MakeKeyState {
  /** The key itself: in this answer only, never stored, never shown again. */
  key: { id: string; token: string; name: string } | null;
  problem: string | null;
}

/**
 * "My assistant", then "My assistant 2", so keys made without a name stay
 * tellable apart. Written in the page's language, then kept as the key's name.
 */
async function defaultName(scope: UserScope, base: string): Promise<string> {
  const taken = new Set(
    (await scope.apiTokens.list()).filter((key) => !key.revokedAt).map((key) => key.name),
  );
  for (let n = 1; ; n += 1) {
    const name = n === 1 ? base : `${base} ${n}`;
    if (!taken.has(name)) return name;
  }
}

/**
 * Make a connection key in one step: a name and an access are optional
 * (read and save by default). Only a hash is stored; the key goes back to
 * the person in this answer and nowhere else. The audit records that a key
 * was made and what it may do, never the key.
 */
export async function makeKey(_state: MakeKeyState, form: FormData): Promise<MakeKeyState> {
  const { scope } = await requireScope();
  const t = await getMessages();
  const rawName = form.get("name");
  const name =
    (typeof rawName === "string" ? rawName.trim() : "").slice(0, 80) ||
    (await defaultName(scope, t.connect.defaultName));
  const access = ApiTokenAccess.safeParse(form.get("access") ?? "read_write");
  if (!access.success) return { key: null, problem: t.connect.problems.access };
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
    return { key: { id: made.apiToken.id, token: made.token, name: made.apiToken.name }, problem: null };
  } catch (error) {
    if (error instanceof InvalidStateError) {
      return { key: null, problem: t.connect.problems.tooMany(MAX_ACTIVE_API_TOKENS) };
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
