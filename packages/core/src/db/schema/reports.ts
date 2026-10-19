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
  uniqueIndex,
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
    /** The person changed the draft's words (the scheduler then leaves it alone). */
    editedAt: timestamp("edited_at", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    consentId: uuid("consent_id"),
    /** When the person was told by email that it is ready. */
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    /** First shared with a practice: from then on the words are final, as after an email. */
    sharedAt: timestamp("shared_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t): PgTableExtraConfigValue[] => [
    index("reports_user_id_period_end_idx").on(t.userId, t.periodEnd),
    unique("reports_id_user_id_key").on(t.id, t.userId),
    // Two reports never end at the same moment: a second preparation of the
    // same period (a retried tick, two workers) is refused by the database.
    unique("reports_user_id_period_end_key").on(t.userId, t.periodEnd),
    // One report per session: two preparations of the same session (two
    // tabs, a retried request) cannot both be kept.
    uniqueIndex("reports_user_id_session_at_key")
      .on(t.userId, t.sessionAt)
      .where(sql`${t.sessionAt} is not null`),
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

export const consentPurpose = pgEnum("consent_purpose", [
  "health_data_processing",
  "report_send",
  "practice_link",
  "report_share",
  "memory",
]);

/**
 * Append-only, versioned consent log. `granted = false` records a withdrawal.
 * A `report_send` consent names the one report it approves; a `practice_link`
 * consent names the link to one practice, and a `report_share` consent names
 * both the report and the link it goes through. A `memory` consent names, as
 * its recipient, the providers that read the diary for the memory.
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
    /** The link to a practice this consent is about. A reference only: the log outlives the link. */
    linkId: uuid("link_id"),
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
    // Compared as text: values added to an enum cannot be used in the transaction that adds them.
    check(
      "consents_practice_names_link",
      sql`${t.purpose}::text not in ('practice_link', 'report_share') or ${t.linkId} is not null`,
    ),
    check(
      "consents_report_share_names_report",
      sql`${t.purpose}::text <> 'report_share' or ${t.reportId} is not null`,
    ),
  ],
);

export const reportRevisionKind = pgEnum("report_revision_kind", ["edited", "prepared_again"]);

/**
 * What a report said before it changed: the person edited the draft, or
 * asked for it to be prepared again. Like an entry's corrections, a change
 * is never a silent rewrite. The section names are clear, the content sealed.
 */
export const reportRevisions = pgTable(
  "report_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: ownerId(),
    reportId: uuid("report_id").notNull(),
    kind: reportRevisionKind("kind").notNull(),
    /** The names of the sections that changed, never their words. */
    sections: text("sections").array().notNull(),
    /** sealed: the whole report content before the change, as JSON */
    previous: bytea("previous").notNull(),
    createdAt: createdAt(),
  },
  (t): PgTableExtraConfigValue[] => [
    index("report_revisions_user_id_report_id_idx").on(t.userId, t.reportId, t.createdAt),
    foreignKey({
      name: "report_revisions_report_owner_fk",
      columns: [t.reportId, t.userId],
      foreignColumns: [reports.id, reports.userId],
    }).onDelete("cascade"),
  ],
);
