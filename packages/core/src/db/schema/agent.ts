import { foreignKey, index, pgEnum, pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { bytea, createdAt, updatedAt } from "../columns";
import { ownerId } from "./auth";

/** Conversations with the embedded agent. Retention is configurable (F5). */
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
