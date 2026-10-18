import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { apiTokens, auditLog } from "../db/schema";
import { ApiTokenInput, AuditInput, type ApiToken, type ApiTokenScope, type AuditEvent } from "../domain";
import { parseInput } from "../errors";
import { isId, type ScopeContext } from "./context";

export const API_TOKEN_PREFIX = "sintr_";

export function hashApiToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function decodeToken(row: typeof apiTokens.$inferSelect): ApiToken {
  return {
    id: row.id,
    name: row.name,
    tokenPrefix: row.tokenPrefix,
    scopes: row.scopes as ApiTokenScope[],
    lastUsedAt: row.lastUsedAt,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
  };
}

export function apiTokensRepository({ db, userId }: ScopeContext) {
  const own = (id: string) => and(eq(apiTokens.id, id), eq(apiTokens.userId, userId));

  return {
    /** Returns the token once. Only its hash is stored. */
    async create(input: ApiTokenInput): Promise<{ token: string; apiToken: ApiToken }> {
      const value = parseInput(ApiTokenInput, input);
      const token = `${API_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
      const [row] = await db
        .insert(apiTokens)
        .values({
          userId,
          name: value.name,
          scopes: [...new Set(value.scopes)],
          expiresAt: value.expiresAt ?? null,
          tokenPrefix: token.slice(0, API_TOKEN_PREFIX.length + 6),
          tokenHash: hashApiToken(token),
        })
        .returning();
      return { token, apiToken: decodeToken(row!) };
    },

    async list(): Promise<ApiToken[]> {
      const rows = await db
        .select()
        .from(apiTokens)
        .where(eq(apiTokens.userId, userId))
        .orderBy(desc(apiTokens.createdAt));
      return rows.map(decodeToken);
    },

    async revoke(id: string): Promise<boolean> {
      if (!isId(id)) return false;
      const rows = await db
        .update(apiTokens)
        .set({ revokedAt: new Date() })
        .where(and(own(id), isNull(apiTokens.revokedAt)))
        .returning({ id: apiTokens.id });
      return rows.length > 0;
    },
  };
}

export function auditLogRepository({ db, userId }: ScopeContext) {
  return {
    async record(input: AuditInput): Promise<void> {
      const value = parseInput(AuditInput, input);
      await db.insert(auditLog).values({
        userId,
        action: value.action,
        targetType: value.targetType ?? null,
        targetId: value.targetId ?? null,
        metadata: value.metadata ?? {},
      });
    },

    async list(limit = 100): Promise<AuditEvent[]> {
      const rows = await db
        .select()
        .from(auditLog)
        .where(eq(auditLog.userId, userId))
        .orderBy(desc(auditLog.createdAt))
        .limit(Math.min(Math.max(limit, 1), 500));
      return rows.map((row) => ({
        id: row.id,
        action: row.action as AuditEvent["action"],
        targetType: row.targetType,
        targetId: row.targetId,
        metadata: row.metadata,
        createdAt: row.createdAt,
      }));
    },
  };
}
