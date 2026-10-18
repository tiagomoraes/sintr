import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { bytea, createdAt, updatedAt } from "../columns";
import { ownerId, users } from "./auth";

/**
 * Conversations with the embedded agent. They are kept until the person
 * deletes them, or for the retention set in `agent_settings`.
 */
export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: ownerId(),
    /** sealed */
    title: bytea("title"),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("conversations_user_id_updated_at_idx").on(t.userId, t.updatedAt),
    unique("conversations_id_user_id_key").on(t.id, t.userId),
  ],
);

export const messageRole = pgEnum("message_role", ["user", "assistant", "system", "tool"]);

/**
 * Messages carry their own `user_id`, and the composite key makes the
 * database refuse a message whose owner differs from its conversation's.
 */
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: ownerId(),
    conversationId: uuid("conversation_id").notNull(),
    role: messageRole("role").notNull(),
    /** sealed */
    content: bytea("content").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("messages_user_id_conversation_id_idx").on(t.userId, t.conversationId, t.createdAt),
    foreignKey({
      name: "messages_conversation_owner_fk",
      columns: [t.conversationId, t.userId],
      foreignColumns: [conversations.id, conversations.userId],
    }).onDelete("cascade"),
  ],
);

export const providerKind = pgEnum("provider_kind", ["openai_compatible", "anthropic", "google"]);

/**
 * The person's assistant: which provider and model to talk to, with their
 * own key (bring your own key), and how long conversations are kept.
 */
export const agentSettings = pgTable(
  "agent_settings",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: providerKind("provider"),
    baseUrl: text("base_url"),
    model: text("model"),
    /** sealed: the API key, never returned to the browser once saved */
    apiKey: bytea("api_key"),
    /** Days a conversation is kept after its last message; null keeps it. */
    conversationRetentionDays: integer("conversation_retention_days"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [check("agent_settings_retention_range", sql`${t.conversationRetentionDays} between 1 and 3650`)],
);

export const proposalKind = pgEnum("proposal_kind", ["entry", "checkin"]);
export const proposalStatus = pgEnum("proposal_status", ["proposed", "saved", "discarded"]);

/**
 * What the assistant drafted from a conversation, waiting for the person.
 * A proposal is never a record: confirming it creates the entry or
 * check-in, inside the same transaction that marks it saved.
 */
export const proposals = pgTable(
  "proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: ownerId(),
    conversationId: uuid("conversation_id").notNull(),
    kind: proposalKind("kind").notNull(),
    status: proposalStatus("status").notNull().default("proposed"),
    /** sealed: the drafted fields, as JSON */
    payload: bytea("payload").notNull(),
    /** The person changed the draft before saving it. */
    edited: boolean("edited").notNull().default(false),
    /** The entry or check-in created when it was saved. */
    recordId: uuid("record_id"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("proposals_user_id_conversation_id_idx").on(t.userId, t.conversationId, t.createdAt),
    foreignKey({
      name: "proposals_conversation_owner_fk",
      columns: [t.conversationId, t.userId],
      foreignColumns: [conversations.id, conversations.userId],
    }).onDelete("cascade"),
    check(
      "proposals_saved_has_record",
      sql`${t.status} <> 'saved' or (${t.recordId} is not null and ${t.decidedAt} is not null)`,
    ),
  ],
);
