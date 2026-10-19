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
  uniqueIndex,
  uuid,
  type PgTableExtraConfigValue,
} from "drizzle-orm/pg-core";
import { bytea, createdAt, updatedAt } from "../columns";
import { ownerId } from "./auth";
import { consents, reports } from "./reports";

/**
 * The therapist's side: a practice, the invites that bring a person and a
 * practice together, the link between them (the unit of trust), the reports
 * the person shared through it, and the notices each side gets.
 *
 * A link is active only when both sides accepted and the person's consent is
 * on record, which the database checks. What travels through a link (the
 * name the person chose, the shared reports) is sealed with that link's own
 * key; ending the link destroys the key, which the database checks too.
 */

/**
 * Where a practice's seats come from: `config` follows the installation's
 * defaults (SINTR_PRACTICE_SEATS, unlimited on a self-host); `grant` is a
 * plan and a seat count set for this practice (the admin path);
 * `subscription` is the practice's plan with the payment provider, whose
 * webhook sets the same two columns.
 */
export const seatSource = pgEnum("seat_source", ["config", "grant", "subscription"]);

/** One per account that opens one. The names are what the professional shows the people they invite. */
export const practices = pgTable(
  "practices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: ownerId(),
    /** sealed: the professional's name, as invited people see it */
    professionalName: bytea("professional_name").notNull(),
    /** sealed: the practice or clinic, optional */
    practiceName: bytea("practice_name"),
    /** sealed: registration details the professional chooses to show (CRP, for example), optional */
    registration: bytea("registration"),
    seatSource: seatSource("seat_source").notNull().default("config"),
    /** With a grant: the plan's label. */
    plan: text("plan"),
    /** With a grant: the seat count; null is unlimited. */
    seats: integer("seats"),
    /** Email the professional (at a confirmed address) when a report arrives. Opt-in. */
    notifyEmail: boolean("notify_email").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("practices_user_id_key").on(t.userId),
    check("practices_seats_range", sql`${t.seats} is null or ${t.seats} between 0 and 100000`),
    check("practices_grant_names_plan", sql`${t.seatSource} = 'config' or ${t.plan} is not null`),
  ],
);

export const inviteDirection = pgEnum("invite_direction", ["practice_to_person", "person_to_practice"]);

/**
 * A code (and its link, /join/<code>) that one side gives the other. Only a
 * keyed hash of the code is looked up; the code itself is kept sealed for
 * its creator, to copy it again. Expiring and revocable.
 */
export const invites = pgTable(
  "invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Who made it: the professional (practice to person) or the person (person to practice). */
    userId: ownerId(),
    direction: inviteDirection("direction").notNull(),
    /** The inviting practice, or, for a person's invite, the practice that accepted it. */
    practiceId: uuid("practice_id").references(() => practices.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull().unique(),
    /** sealed: the code, for its creator only */
    code: bytea("code").notNull(),
    /** sealed: the professional's own note on who it is for, never shown to the person */
    note: bytea("note"),
    /** sealed: for a person's invite, the name they chose to be seen as */
    personName: bytea("person_name"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    linkId: uuid("link_id").references(() => links.id, { onDelete: "set null" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("invites_user_id_created_at_idx").on(t.userId, t.createdAt),
    index("invites_practice_id_idx").on(t.practiceId),
    check(
      "invites_practice_invite_names_practice",
      sql`${t.direction} = 'person_to_practice' or ${t.practiceId} is not null`,
    ),
  ],
);

export const linkStatus = pgEnum("link_status", ["pending", "active", "ended"]);
export const shareMode = pgEnum("share_mode", ["ask", "auto"]);
export const linkParty = pgEnum("link_party", ["person", "practice"]);

/**
 * One person and one practice. `pending` waits for the person to confirm a
 * practice that accepted their invite; `active` needs both acceptances and
 * the person's consent; `ended` holds no key and no name.
 */
export const links = pgTable(
  "links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** The person: the owner of everything shared through the link. */
    userId: ownerId(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id, { onDelete: "cascade" }),
    status: linkStatus("status").notNull(),
    /** The practice's own count, for a neutral label ("Patient 3") when the person chose no name. */
    number: integer("number").notNull(),
    /** sealed with the link's key: the name the person chose to be seen as */
    personName: bytea("person_name"),
    shareMode: shareMode("share_mode").notNull().default("ask"),
    /** The link's own data key, wrapped by the master key named by `kek_id`; destroyed when it ends. */
    kekId: text("kek_id"),
    wrappedKey: bytea("wrapped_key"),
    personAcceptedAt: timestamp("person_accepted_at", { withTimezone: true }),
    practiceAcceptedAt: timestamp("practice_accepted_at", { withTimezone: true }),
    /** The person's consent to share approved reports with this practice. */
    consentId: uuid("consent_id"),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    endedBy: linkParty("ended_by"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t): PgTableExtraConfigValue[] => [
    index("links_user_id_created_at_idx").on(t.userId, t.createdAt),
    index("links_practice_id_status_idx").on(t.practiceId, t.status),
    unique("links_id_user_id_key").on(t.id, t.userId),
    uniqueIndex("links_practice_id_number_key").on(t.practiceId, t.number),
    // One open link per person and practice.
    uniqueIndex("links_user_id_practice_id_open_key")
      .on(t.userId, t.practiceId)
      .where(sql`${t.status} <> 'ended'`),
    foreignKey({
      name: "links_consent_owner_fk",
      columns: [t.consentId, t.userId],
      foreignColumns: [consents.id, consents.userId],
    }),
    check(
      "links_active_needs_both",
      sql`${t.status} <> 'active' or (${t.consentId} is not null and ${t.personAcceptedAt} is not null and ${t.practiceAcceptedAt} is not null)`,
    ),
    check(
      "links_open_holds_key",
      sql`${t.status} = 'ended' or (${t.wrappedKey} is not null and ${t.kekId} is not null)`,
    ),
    check(
      "links_ended_holds_nothing",
      sql`${t.status} <> 'ended' or (${t.endedAt} is not null and ${t.endedBy} is not null and ${t.wrappedKey} is null and ${t.personName} is null)`,
    ),
    check("links_number_positive", sql`${t.number} > 0`),
  ],
);

/**
 * An approved report the person shared through a link: a copy of what they
 * approved (the page and its PDF), sealed with the link's key. It needs the
 * person's consent naming the report, and it goes when the link ends.
 */
export const sharedReports = pgTable(
  "shared_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: ownerId(),
    linkId: uuid("link_id").notNull(),
    reportId: uuid("report_id").notNull(),
    consentId: uuid("consent_id").notNull(),
    sessionAt: timestamp("session_at", { withTimezone: true }),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    /** sealed with the link's key: the report as the person approved it, to read in place */
    snapshot: bytea("snapshot").notNull(),
    /** sealed with the link's key: the approved PDF */
    pdf: bytea("pdf").notNull(),
    firstReadAt: timestamp("first_read_at", { withTimezone: true }),
    /** When the professional was told by email. */
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t): PgTableExtraConfigValue[] => [
    index("shared_reports_user_id_created_at_idx").on(t.userId, t.createdAt),
    index("shared_reports_link_id_created_at_idx").on(t.linkId, t.createdAt),
    unique("shared_reports_link_id_report_id_key").on(t.linkId, t.reportId),
    foreignKey({
      name: "shared_reports_link_owner_fk",
      columns: [t.linkId, t.userId],
      foreignColumns: [links.id, links.userId],
    }).onDelete("cascade"),
    foreignKey({
      name: "shared_reports_report_owner_fk",
      columns: [t.reportId, t.userId],
      foreignColumns: [reports.id, reports.userId],
    }).onDelete("cascade"),
    foreignKey({
      name: "shared_reports_consent_owner_fk",
      columns: [t.consentId, t.userId],
      foreignColumns: [consents.id, consents.userId],
    }),
  ],
);

export const notificationKind = pgEnum("notification_kind", [
  "link_pending",
  "link_active",
  "link_declined",
  "link_ended",
  "report_shared",
]);

/** In-app notices. Kinds and ids only: what they say is written when they are shown. */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Who it is for. */
    userId: ownerId(),
    kind: notificationKind("kind").notNull(),
    linkId: uuid("link_id").references(() => links.id, { onDelete: "cascade" }),
    sharedReportId: uuid("shared_report_id").references(() => sharedReports.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_id_created_at_idx").on(t.userId, t.createdAt)],
);
