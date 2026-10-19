import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, updatedAt } from "../columns";
import { ownerId } from "./auth";

/**
 * Plans: what an account pays for (or was given), and how much of the house
 * assistant a person used each month. Clear metadata only: a plan, a status,
 * dates, counts and the payment provider's ids. No card data is ever here;
 * the payment provider keeps it.
 */

export const subscriptionKind = pgEnum("subscription_kind", ["person", "practice"]);
export const subscriptionStatus = pgEnum("subscription_status", [
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "paused",
  "incomplete",
  "incomplete_expired",
  "canceled",
]);
export const subscriptionSource = pgEnum("subscription_source", ["grant", "stripe"]);

/**
 * One per account and kind: the person's own plan, and the plan of the
 * practice the account opened. `grant` is set by whoever runs the
 * installation (the admin path); `stripe` follows the payment provider's
 * webhook. A person without a row is on the installation's default plan.
 */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: ownerId(),
    kind: subscriptionKind("kind").notNull(),
    /** For a person, "personal" or "unlimited"; for a practice, "practice". */
    plan: text("plan").notNull(),
    status: subscriptionStatus("status").notNull(),
    source: subscriptionSource("source").notNull(),
    /** A practice's seats, from the subscription's quantity. */
    seats: integer("seats"),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    /** The payment provider's customer and subscription, by id. */
    providerCustomerId: text("provider_customer_id"),
    providerSubscriptionId: text("provider_subscription_id").unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("subscriptions_user_id_kind_key").on(t.userId, t.kind),
    check("subscriptions_seats_range", sql`${t.seats} is null or ${t.seats} between 0 and 100000`),
    check(
      "subscriptions_provider_names_subscription",
      sql`${t.source} = 'grant' or ${t.providerSubscriptionId} is not null`,
    ),
  ],
);

/**
 * How much of the house assistant a person used in one month of their own
 * calendar. Counts only, never what was said. A unit is taken before the
 * assistant runs (refused at the plan's limit, atomically) and given back
 * when the call fails. Keyed by the month itself, so changing time zone
 * cannot start a month twice.
 */
export const usageCounters = pgTable(
  "usage_counters",
  {
    userId: ownerId(),
    /** The month's first day, as the person's calendar has it. */
    period: date("period", { mode: "string" }).notNull(),
    assistantMessages: integer("assistant_messages").notNull().default(0),
    reports: integer("reports").notNull().default(0),
    /** Never counted: F5's placeholder. Spoken time is counted in seconds, below (DECISIONS 86). */
    audioMinutes: integer("audio_minutes").notNull().default(0),
    /** Seconds of speech the house transcribed this month. */
    audioSeconds: integer("audio_seconds").notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ name: "usage_counters_pkey", columns: [t.userId, t.period] }),
    check("usage_counters_period_is_month", sql`extract(day from ${t.period}) = 1`),
    check(
      "usage_counters_not_negative",
      sql`${t.assistantMessages} >= 0 and ${t.reports} >= 0 and ${t.audioMinutes} >= 0`,
    ),
    check("usage_counters_audio_seconds_not_negative", sql`${t.audioSeconds} >= 0`),
  ],
);

export type SubscriptionRow = typeof subscriptions.$inferSelect;
