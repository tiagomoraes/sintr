import { and, eq, gt, isNull, or } from "drizzle-orm";
import type { Executor } from "../db/client";
import { apiTokens } from "../db/schema";
import type { ApiTokenScope } from "../domain";
import { sanitizeError } from "../errors";
import { API_TOKEN_PREFIX, hashApiToken } from "../repositories";

export interface ApiTokenPrincipal {
  userId: string;
  tokenId: string;
  scopes: ApiTokenScope[];
}

/**
 * A client's name for itself, as it may be stored and shown: letters,
 * digits, spaces and `._-()/` only, at most 60 characters. Anything else is
 * dropped; an empty result is no name.
 */
export function clientName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const kept = raw
    .replace(/[^\p{L}\p{N} ._()/-]+/gu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 60)
    .trim();
  return kept.length > 0 ? kept : null;
}

/**
 * Resolve a bearer token to its owner. Like a session lookup, this is the one
 * place a query is not scoped by user: it is how the user is found. Revoked
 * and expired tokens resolve to nothing. A successful lookup records when
 * the token was used and, when the client named itself (at an MCP
 * `initialize`), that name, so the person can see the connection is alive.
 */
export async function authenticateApiToken(
  db: Executor,
  token: string,
  use: { client?: string | null } = {},
): Promise<ApiTokenPrincipal | null> {
  if (!token.startsWith(API_TOKEN_PREFIX) || token.length > 200) return null;
  const client = clientName(use.client);
  try {
    const now = new Date();
    const [row] = await db
      .select({ id: apiTokens.id, userId: apiTokens.userId, scopes: apiTokens.scopes })
      .from(apiTokens)
      .where(
        and(
          eq(apiTokens.tokenHash, hashApiToken(token)),
          isNull(apiTokens.revokedAt),
          or(isNull(apiTokens.expiresAt), gt(apiTokens.expiresAt, now)),
        ),
      );
    if (!row) return null;
    await db
      .update(apiTokens)
      .set({ lastUsedAt: now, ...(client ? { lastClient: client } : {}) })
      .where(eq(apiTokens.id, row.id));
    return { userId: row.userId, tokenId: row.id, scopes: row.scopes as ApiTokenScope[] };
  } catch (error) {
    throw sanitizeError(error);
  }
}
