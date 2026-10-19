import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { bytea, createdAt, updatedAt, vector } from "../columns";
import { ownerId } from "./auth";
import { checkins, entries } from "./ledger";

/**
 * The memory (F10): what sintr remembers of a person, drawn from their own
 * diary, for their own assistant. It exists only while the person's memory
 * consent stands; withdrawing it deletes every row here.
 *
 * - `name`: how they want to be called, from the welcome.
 * - `about`: who they are (the people in their life, their work, what matters to them).
 * - `moment`: something that happened, dated by its source.
 */
export const memoryKind = pgEnum("memory_kind", ["name", "about", "moment"]);

export const memories = pgTable(
  "memories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: ownerId(),
    kind: memoryKind("kind").notNull(),
    /** sealed: what is remembered, in a sentence (for `name`, the name itself) */
    text: bytea("text").notNull(),
    /** sealed: the person's own words it rests on, found word for word in its source */
    quote: bytea("quote"),
    /** The entry or check-in it came from; deleting that deletes the memory. None for the name. */
    entryId: uuid("entry_id"),
    checkinId: uuid("checkin_id"),
    /** When what it remembers happened: its source's own time, as clear as the source's. */
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    /**
     * Where it sits by meaning: the provider's vector turned by the person's
     * own rotation (`ROTATED` in sealed.ts), never the provider's vector
     * itself. Null for the name, and until it is computed.
     */
    embedding: vector("embedding"),
    /** The model that made the vector and its length ("text-embedding-3-small@1536"): only one space is compared. */
    embeddingModel: text("embedding_model"),
    /** When the person corrected it. A corrected memory is theirs: a new reading of its source never replaces it. */
    editedAt: timestamp("edited_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("memories_user_id_kind_idx").on(t.userId, t.kind, t.occurredAt),
    index("memories_user_id_model_idx").on(t.userId, t.embeddingModel),
    foreignKey({
      name: "memories_entry_owner_fk",
      columns: [t.entryId, t.userId],
      foreignColumns: [entries.id, entries.userId],
    }).onDelete("cascade"),
    foreignKey({
      name: "memories_checkin_owner_fk",
      columns: [t.checkinId, t.userId],
      foreignColumns: [checkins.id, checkins.userId],
    }).onDelete("cascade"),
    // The name comes from the welcome; everything else from exactly one entry or check-in, with the words it rests on.
    check(
      "memories_source",
      sql`case when ${t.kind} = 'name' then num_nonnulls(${t.entryId}, ${t.checkinId}) = 0
        else num_nonnulls(${t.entryId}, ${t.checkinId}) = 1 and ${t.quote} is not null end`,
    ),
    check("memories_vector_has_model", sql`(${t.embedding} is null) = (${t.embeddingModel} is null)`),
  ],
);

/**
 * Which entries and check-ins sintr has read for the memory, and which
 * version of each (a correction is read again). Ids and times only: what a
 * reading found is in `memories`, and forgetting a memory leaves its source
 * read, so it is not remembered again on its own.
 */
export const memoryReads = pgTable(
  "memory_reads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: ownerId(),
    entryId: uuid("entry_id"),
    checkinId: uuid("checkin_id"),
    /** The source's `updated_at` when it was read. */
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }).notNull(),
    readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("memory_reads_user_id_entry_id_key").on(t.userId, t.entryId),
    uniqueIndex("memory_reads_user_id_checkin_id_key").on(t.userId, t.checkinId),
    foreignKey({
      name: "memory_reads_entry_owner_fk",
      columns: [t.entryId, t.userId],
      foreignColumns: [entries.id, entries.userId],
    }).onDelete("cascade"),
    foreignKey({
      name: "memory_reads_checkin_owner_fk",
      columns: [t.checkinId, t.userId],
      foreignColumns: [checkins.id, checkins.userId],
    }).onDelete("cascade"),
    check("memory_reads_one_source", sql`num_nonnulls(${t.entryId}, ${t.checkinId}) = 1`),
  ],
);
