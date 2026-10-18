import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  type PgTableExtraConfigValue,
} from "drizzle-orm/pg-core";
import { bytea, createdAt, updatedAt } from "../columns";
import { ownerId } from "./auth";

export const reportStatus = pgEnum("report_status", ["draft", "reviewed", "sent"]);

/**
 * A pre-session report. It can only become `sent` with a recorded consent of
 * the same user (invariant 3), enforced by a check and a composite key.
 */
export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: ownerId(),
    sessionAt: timestamp("session_at", { withTimezone: true }),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    status: reportStatus("status").notNull().default("draft"),
    /** sealed: the report Markdown */
    content: bytea("content"),
    /** sealed: the rendered PDF */
    pdf: bytea("pdf"),
    /** sealed: who it was sent to */
    recipient: bytea("recipient"),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    consentId: uuid("consent_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t): PgTableExtraConfigValue[] => [
    index("reports_user_id_period_end_idx").on(t.userId, t.periodEnd),
    unique("reports_id_user_id_key").on(t.id, t.userId),
    foreignKey({
      name: "reports_consent_owner_fk",
      columns: [t.consentId, t.userId],
      foreignColumns: [consents.id, consents.userId],
    }),
    check("reports_period_order", sql`${t.periodEnd} > ${t.periodStart}`),
    check(
      "reports_sent_requires_consent",
      sql`${t.status} <> 'sent' or (${t.sentAt} is not null and ${t.consentId} is not null and ${t.recipient} is not null)`,
    ),
  ],
);

export const consentPurpose = pgEnum("consent_purpose", ["health_data_processing", "report_send"]);

/**
 * Append-only, versioned consent log. `granted = false` records a withdrawal.
 * A `report_send` consent names the one report it approves.
 */
export const consents = pgTable(
  "consents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: ownerId(),
    purpose: consentPurpose("purpose").notNull(),
    version: text("version").notNull(),
    granted: boolean("granted").notNull(),
    reportId: uuid("report_id"),
    /** sealed: the recipient approved for this send */
    recipient: bytea("recipient"),
    createdAt: createdAt(),
  },
  (t): PgTableExtraConfigValue[] => [
    index("consents_user_id_purpose_idx").on(t.userId, t.purpose, t.createdAt),
    unique("consents_id_user_id_key").on(t.id, t.userId),
    foreignKey({
      name: "consents_report_owner_fk",
      columns: [t.reportId, t.userId],
      foreignColumns: [reports.id, reports.userId],
    }).onDelete("cascade"),
    check(
      "consents_report_send_names_report",
      sql`${t.purpose} <> 'report_send' or ${t.reportId} is not null`,
    ),
  ],
);
