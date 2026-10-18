import { sql } from "drizzle-orm";
import { boolean, check, integer, pgEnum, pgTable, smallint, text, time } from "drizzle-orm/pg-core";
import { bytea, createdAt, updatedAt } from "../columns";
import { users } from "./auth";

export const profiles = pgTable("profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  /** sealed */
  displayName: bytea("display_name"),
  language: text("language").notNull().default("en"),
  timezone: text("timezone").notNull().default("UTC"),
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
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("therapy_settings_session_day_range", sql`${t.sessionDay} between 0 and 6`),
    check("therapy_settings_report_lead_range", sql`${t.reportLeadMinutes} between 0 and 10080`),
    check("therapy_settings_require_approval", sql`${t.requireApproval} = true`),
  ],
);
