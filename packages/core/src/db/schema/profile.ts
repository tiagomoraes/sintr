import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { bytea, createdAt, updatedAt } from "../columns";
import { ownerId, users } from "./auth";

export const profiles = pgTable("profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  /** sealed: the name printed on the person's reports, chosen in Therapy */
  displayName: bytea("display_name"),
  /** sealed: how the person wants to be called; given to their assistant only while their memory is on (DECISIONS 116), never on a report */
  preferredName: bytea("preferred_name"),
  /** Until F7 the report's language, chosen in Therapy. No longer read: see `report_language`. */
  language: text("language").notNull().default("en"),
  /** The language the person chose for sintr (a catalog's code, such as pt-BR); null until they choose. */
  locale: text("locale"),
  /** The language sintr last spoke to the person in, for what it writes while they are away. */
  seenLocale: text("seen_locale"),
  /** The language the person chose for their reports in Therapy; null follows their language. */
  reportLanguage: text("report_language"),
  timezone: text("timezone").notNull().default("UTC"),
  /** When the person finished (or set aside) the welcome after signing up; null until then. */
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const deliveryChannel = pgEnum("delivery_channel", ["download", "email"]);

export const therapySettings = pgTable(
  "therapy_settings",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    /** sealed */
    therapistName: bytea("therapist_name"),
    /** sealed */
    therapistContact: bytea("therapist_contact"),
    /**
     * The weekly slot of F0 to F8: 0 = Sunday ... 6 = Saturday, and a time, in the
     * profile's timezone. Unused since F11 (DECISIONS 113): the sessions are a calendar,
     * `therapy_series`, and 0009 moved every slot there as a weekly rhythm and emptied
     * these. Migrations are additive, so the columns stay; nothing reads or writes them.
     */
    sessionDay: smallint("session_day"),
    sessionTime: time("session_time"),
    reportLeadMinutes: integer("report_lead_minutes").notNull().default(60),
    /**
     * Kept for parity with the pack's config. Invariant 3 (nothing leaves
     * without explicit, per-instance consent) is not configurable, so the
     * database refuses `false`.
     */
    requireApproval: boolean("require_approval").notNull().default(true),
    deliveryChannel: deliveryChannel("delivery_channel").notNull().default("download"),
    /**
     * Unused since F8 (DECISIONS 111): it held a one-off date for a session
     * that moved, which Therapy no longer asks. Migrations are additive, so
     * the column stays; 0008 emptied it and nothing reads or writes it.
     */
    nextSessionAt: timestamp("next_session_at", { withTimezone: true }),
    /** Email the person (at a verified address) when a report is ready. Opt-in. */
    reportNoticeEmail: boolean("report_notice_email").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("therapy_settings_session_day_range", sql`${t.sessionDay} between 0 and 6`),
    check("therapy_settings_report_lead_range", sql`${t.reportLeadMinutes} between 0 and 10080`),
    check("therapy_settings_require_approval", sql`${t.requireApproval} = true`),
  ],
);

export const sessionRepeat = pgEnum("session_repeat", [
  "once",
  "weekly",
  "fortnightly",
  "every_15_days",
  "weekdays",
]);

/**
 * The therapy calendar (F11): each row is a session the person added, one
 * date or the first of a rhythm. A day, a time and how it repeats, read in
 * the profile's timezone: clear metadata, like the weekly slot it replaces,
 * which the scheduler reads across people. There is no free text here, and
 * nothing here may become a place to write any.
 */
export const therapySeries = pgTable(
  "therapy_series",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: ownerId(),
    /** The first session's local day. */
    startsOn: date("starts_on").notNull(),
    sessionTime: time("session_time").notNull(),
    repeat: sessionRepeat("repeat").notNull(),
    /** For `weekdays`: the days of the week it falls on, 0 = Sunday ... 6 = Saturday. */
    weekdays: smallint("weekdays").array(),
    /** The rhythm holds no session on or after this local day (it was stopped there); null while it goes on. */
    stopsOn: date("stops_on"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("therapy_series_user_id_idx").on(t.userId),
    unique("therapy_series_id_user_id_key").on(t.id, t.userId),
    check(
      "therapy_series_weekdays",
      sql`(${t.repeat} = 'weekdays') = (${t.weekdays} is not null) and (${t.weekdays} is null or (cardinality(${t.weekdays}) between 1 and 7 and ${t.weekdays} <@ '{0,1,2,3,4,5,6}'::smallint[]))`,
    ),
    check("therapy_series_stops_after_start", sql`${t.stopsOn} is null or ${t.stopsOn} > ${t.startsOn}`),
  ],
);

/**
 * One session of a rhythm, moved or cancelled on its own: named by its
 * series and its own day in it, so the change is for exactly the session
 * the person chose, and the rest of the rhythm is untouched.
 */
export const therapySeriesChanges = pgTable(
  "therapy_series_changes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: ownerId(),
    seriesId: uuid("series_id").notNull(),
    /** The session's own day in its series. */
    occursOn: date("occurs_on").notNull(),
    /** Where it moved to; both empty when it was cancelled. */
    movedOn: date("moved_on"),
    movedTime: time("moved_time"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("therapy_series_changes_user_id_idx").on(t.userId),
    unique("therapy_series_changes_session_key").on(t.seriesId, t.occursOn),
    foreignKey({
      name: "therapy_series_changes_series_owner_fk",
      columns: [t.seriesId, t.userId],
      foreignColumns: [therapySeries.id, therapySeries.userId],
    }).onDelete("cascade"),
    check("therapy_series_changes_moved_whole", sql`(${t.movedOn} is null) = (${t.movedTime} is null)`),
  ],
);
