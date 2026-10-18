import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createdAt } from "../columns";
import { ownerId } from "./auth";

/**
 * Tokens for external agents over MCP. Only a SHA-256 hash of the token is
 * stored; the token itself is shown once, at creation. Scopes are per data
 * type and access (for example `entries:read`).
 */
export const apiTokens = pgTable(
  "api_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: ownerId(),
    /** A label the person chose, such as the name of their agent. */
    name: text("name").notNull(),
    /** The first characters of the token, to recognise it in a list. */
    tokenPrefix: text("token_prefix").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    scopes: text("scopes").array().notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    /** The client's own name for itself at its last connection (MCP `clientInfo.name`), sanitised. */
    lastClient: text("last_client"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("api_tokens_user_id_idx").on(t.userId)],
);

/**
 * What happened to an account, never what was written in it. `metadata`
 * holds identifiers and codes only; the repository validates it.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: ownerId(),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    metadata: jsonb("metadata")
      .$type<Record<string, string | number | boolean | null>>()
      .notNull()
      .default({}),
    createdAt: createdAt(),
  },
  (t) => [index("audit_log_user_id_created_at_idx").on(t.userId, t.createdAt)],
);
