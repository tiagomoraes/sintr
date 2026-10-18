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
 * Resolve a bearer token to its owner. Like a session lookup, this is the one
 * place a query is not scoped by user: it is how the user is found. Revoked
 * and expired tokens resolve to nothing.
 */
export async function authenticateApiToken(db: Executor, token: string): Promise<ApiTokenPrincipal | null> {
  if (!token.startsWith(API_TOKEN_PREFIX) || token.length > 200) return null;
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
    await db.update(apiTokens).set({ lastUsedAt: now }).where(eq(apiTokens.id, row.id));
    return { userId: row.userId, tokenId: row.id, scopes: row.scopes as ApiTokenScope[] };
  } catch (error) {
    throw sanitizeError(error);
  }
}
