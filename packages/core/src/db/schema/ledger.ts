import { sql } from "drizzle-orm";
import {
  check,
  date,
  foreignKey,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { bytea, createdAt, updatedAt } from "../columns";
import { ownerId } from "./auth";

/**
 * The ledger. Free text is sealed (bytea, encrypted per user); dates and the
 * 0 to 100 and 0 to 5 scales stay in the clear so they can be aggregated
 * without decrypting anything. Every content field is optional: capture first,
 * analyse later.
 */

/** A thought record (Beck), Tier 1 plus the optional Tier 2 working stage. */
export const entries = pgTable(
  "entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: ownerId(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    title: bytea("title"),
    situation: bytea("situation"),
    /** JSON array of verbatim thoughts. */
    thoughts: bytea("thoughts"),
    /** JSON array of { name, intensity } in the person's own words. */
    emotions: bytea("emotions"),
    body: bytea("body"),
    behavior: bytea("behavior"),
    context: bytea("context"),
    /** JSON array of tags. */
    tags: bytea("tags"),
    notes: bytea("notes"),
    hotThought: bytea("hot_thought"),
    evidenceFor: bytea("evidence_for"),
    evidenceAgainst: bytea("evidence_against"),
    alternative: bytea("alternative"),
    /** 0 to 100, how believable the alternative thought feels. */
    alternativeBelief: smallint("alternative_belief"),
    /** JSON array of { name, intensity } after the working stage. */
    emotionsAfter: bytea("emotions_after"),
    /** 0 to 100, the strongest emotion at the time; derived, kept clear. */
    peakIntensity: smallint("peak_intensity"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("entries_user_id_occurred_at_idx").on(t.userId, t.occurredAt),
    unique("entries_id_user_id_key").on(t.id, t.userId),
    check("entries_alternative_belief_range", sql`${t.alternativeBelief} between 0 and 100`),
    check("entries_peak_intensity_range", sql`${t.peakIntensity} between 0 and 100`),
  ],
);

/** A quick check-in. Only what the person gave; never invented. */
export const checkins = pgTable(
  "checkins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: ownerId(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    mood: smallint("mood"),
    energy: smallint("energy"),
    anxiety: smallint("anxiety"),
    sleepHours: numeric("sleep_hours", { precision: 3, scale: 1, mode: "number" }),
    sleepQuality: bytea("sleep_quality"),
    note: bytea("note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("checkins_user_id_occurred_at_idx").on(t.userId, t.occurredAt),
    unique("checkins_id_user_id_key").on(t.id, t.userId),
    check("checkins_mood_range", sql`${t.mood} between 0 and 5`),
    check("checkins_energy_range", sql`${t.energy} between 0 and 5`),
    check("checkins_anxiety_range", sql`${t.anxiety} between 0 and 5`),
    check("checkins_sleep_hours_range", sql`${t.sleepHours} between 0 and 24`),
  ],
);

/**
 * A dated correction of an entry or a check-in. The record itself shows the
 * current words; what each changed field held before is kept here, so a
 * change is never a silent rewrite. Field names are clear, values sealed.
 */
export const corrections = pgTable(
  "corrections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: ownerId(),
    entryId: uuid("entry_id"),
    checkinId: uuid("checkin_id"),
    /** The names of the fields that changed, never their values. */
    fields: text("fields").array().notNull(),
    /** sealed: the values those fields held before, as JSON */
    previous: bytea("previous").notNull(),
    /** sealed: the person's own note about the change, if any */
    note: bytea("note"),
    createdAt: createdAt(),
  },
  (t) => [
    index("corrections_user_id_entry_id_idx").on(t.userId, t.entryId, t.createdAt),
    index("corrections_user_id_checkin_id_idx").on(t.userId, t.checkinId, t.createdAt),
    foreignKey({
      name: "corrections_entry_owner_fk",
      columns: [t.entryId, t.userId],
      foreignColumns: [entries.id, entries.userId],
    }).onDelete("cascade"),
    foreignKey({
      name: "corrections_checkin_owner_fk",
      columns: [t.checkinId, t.userId],
      foreignColumns: [checkins.id, checkins.userId],
    }).onDelete("cascade"),
    check("corrections_one_record", sql`num_nonnulls(${t.entryId}, ${t.checkinId}) = 1`),
  ],
);

export const therapyNoteKind = pgEnum("therapy_note_kind", ["session", "goal", "theme", "task", "to_bring"]);

/** Therapy context (goals, themes, tasks, things to bring) and session notes. */
export const therapyNotes = pgTable(
  "therapy_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: ownerId(),
    kind: therapyNoteKind("kind").notNull(),
    body: bytea("body").notNull(),
    sessionOn: date("session_on", { mode: "string" }),
    doneAt: timestamp("done_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("therapy_notes_user_id_kind_idx").on(t.userId, t.kind)],
);

export const insightKind = pgEnum("insight_kind", ["pattern", "helps", "question"]);

/** Dated observations. Observations, never diagnoses. */
export const insights = pgTable(
  "insights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: ownerId(),
    kind: insightKind("kind").notNull(),
    body: bytea("body").notNull(),
    /** References (ids and dates) to the entries and check-ins it rests on. */
    evidence: jsonb("evidence").$type<{ kind: "entry" | "checkin"; id: string }[]>().notNull().default([]),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("insights_user_id_kind_idx").on(t.userId, t.kind)],
);
