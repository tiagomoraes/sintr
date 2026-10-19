import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
} from "drizzle-orm/pg-core";
import { bytea, createdAt, updatedAt } from "../columns";
import { users } from "./auth";

export const profiles = pgTable("profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  /** sealed: the name printed on the person's reports, chosen in Therapy */
  displayName: bytea("display_name"),
  /** sealed: how the person wants to be called in the app; never sent to a model, never on a report */
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
    /** 0 = Sunday ... 6 = Saturday, in the profile's timezone. */
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
     * A one-off date for the next session, when it moved: it replaces the
     * weekly session closest to it, and the weekly schedule resumes after it.
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
