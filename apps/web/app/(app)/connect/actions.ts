"use server";

import {
  API_TOKEN_ACCESS,
  ApiTokenAccess,
  InvalidStateError,
  MAX_ACTIVE_API_TOKENS,
  type ApiTokenScope,
} from "@sintr/core";
import { revalidatePath } from "next/cache";
import { requireScope } from "@/lib/server/runtime";

export interface MakeKeyState {
  /** The key itself: in this answer only, never stored, never shown again. */
  key: { id: string; token: string; name: string } | null;
  problem: string | null;
}

const DEFAULT_NAME = "My assistant";

/**
 * Make a connection key in one step: a name and an access are optional
 * (read and save by default). Only a hash is stored; the key goes back to
 * the person in this answer and nowhere else. The audit records that a key
 * was made and what it may do, never the key.
 */
export async function makeKey(_state: MakeKeyState, form: FormData): Promise<MakeKeyState> {
  const { scope } = await requireScope();
  const rawName = form.get("name");
  const name = (typeof rawName === "string" ? rawName.trim() : "").slice(0, 80) || DEFAULT_NAME;
  const access = ApiTokenAccess.safeParse(form.get("access") ?? "read_write");
  if (!access.success) return { key: null, problem: "Choose what your assistant may do." };
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
      return {
        key: null,
        problem: `You already have ${MAX_ACTIVE_API_TOKENS} keys. Disconnect one you no longer use, then make a new one.`,
      };
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
