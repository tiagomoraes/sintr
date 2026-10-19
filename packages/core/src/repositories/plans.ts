import { and, eq, sql } from "drizzle-orm";
import type { Executor } from "../db/client";
import { practices, profiles, subscriptions, usageCounters, type SubscriptionRow } from "../db/schema";
import {
  METERS,
  PERSON_PLANS,
  PlanId,
  isEntitling,
  type Entitlements,
  type Meter,
  type PersonPlan,
  type PlanSource,
  type Subscription,
  type SubscriptionKind,
  type Taken,
  type TakenAudio,
  type UsagePeriod,
} from "../domain";
import type { ScopeContext } from "./context";

/** The meters counted one unit at a time. Speech is counted in seconds (`takeAudio`). */
const COLUMNS = {
  assistantMessages: usageCounters.assistantMessages,
  reports: usageCounters.reports,
} as const satisfies Partial<Record<Meter, unknown>>;
type UnitMeter = keyof typeof COLUMNS;

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The month that holds `now` in the person's own calendar: its first day,
 * and the first day of the next one, when the count starts again.
 */
export function usagePeriod(now: Date, timeZone: string): UsagePeriod {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit" }).formatToParts(
      now,
    );
  } catch {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
    }).formatToParts(now);
  }
  const year = Number(parts.find((part) => part.type === "year")!.value);
  const month = Number(parts.find((part) => part.type === "month")!.value);
  return {
    start: `${year}-${pad(month)}-01`,
    next: month === 12 ? `${year + 1}-01-01` : `${year}-${pad(month + 1)}-01`,
  };
}

export function decodeSubscription(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    kind: row.kind,
    plan: row.plan,
    status: row.status,
    source: row.source,
    seats: row.seats,
    currentPeriodStart: row.currentPeriodStart,
    currentPeriodEnd: row.currentPeriodEnd,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    hasCustomer: row.providerCustomerId !== null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const RANK: Record<PlanId, number> = { free: 0, personal: 1, unlimited: 2 };

/**
 * The best plan an account holds: the installation's default, the person's
 * own grant or subscription (while its status keeps the plan), or Personal
 * included with a practice on a plan of its own (granted or paid). Sharing
 * with a practice never changes a person's plan, so stopping costs nothing.
 */
export function resolvePlan(input: {
  installation: PlanId;
  own: Pick<Subscription, "plan" | "status" | "source"> | null;
  practiceSeats: "config" | "grant" | "subscription" | null;
}): PersonPlan {
  const candidates: { id: PlanId; source: PlanSource }[] = [
    { id: input.installation, source: "installation" },
  ];
  if (input.practiceSeats === "grant" || input.practiceSeats === "subscription") {
    candidates.push({ id: "personal", source: "practice" });
  }
  const ownPlan = PlanId.safeParse(input.own?.plan);
  if (input.own && ownPlan.success && isEntitling(input.own.status)) {
    candidates.push({ id: ownPlan.data, source: input.own.source === "grant" ? "grant" : "subscription" });
  }
  // The highest plan wins; on a tie, the later one: the person's own, then the practice's.
  const best = candidates.reduce((a, b) => (RANK[b.id] >= RANK[a.id] ? b : a));
  return {
    id: best.id,
    label: PERSON_PLANS[best.id].label,
    source: best.source,
    allowance: PERSON_PLANS[best.id].allowance,
  };
}

export interface PlansContext extends ScopeContext {
  /** The plan of a person without a subscription or a grant. */
  readonly personPlan: PlanId;
}

/**
 * The person's plan and how much of the house assistant they used this
 * month. Counts only. Units are taken before the assistant runs, refused at
 * the limit in the same statement that counts them (so two tabs cannot both
 * take the last one), and given back when the call fails.
 */
export function plansRepository({ db, userId, personPlan }: PlansContext) {
  const timeZone = async (executor: Executor) => {
    const [row] = await executor
      .select({ timezone: profiles.timezone })
      .from(profiles)
      .where(eq(profiles.userId, userId));
    return row?.timezone ?? "UTC";
  };
  const ownRow = async (executor: Executor, kind: SubscriptionKind) => {
    const [row] = await executor
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, userId), eq(subscriptions.kind, kind)));
    return row;
  };
  const plan = async (executor: Executor) => {
    const [own, practice] = await Promise.all([
      ownRow(executor, "person"),
      executor
        .select({ seatSource: practices.seatSource })
        .from(practices)
        .where(eq(practices.userId, userId))
        .then((rows) => rows[0]),
    ]);
    return {
      own: own ? decodeSubscription(own) : null,
      plan: resolvePlan({
        installation: personPlan,
        own: own ?? null,
        practiceSeats: practice?.seatSource ?? null,
      }),
    };
  };
  const counters = async (executor: Executor, period: UsagePeriod) => {
    const [row] = await executor
      .select()
      .from(usageCounters)
      .where(and(eq(usageCounters.userId, userId), eq(usageCounters.period, period.start)));
    return row;
  };
  const used = async (executor: Executor, period: UsagePeriod) => {
    const row = await counters(executor, period);
    return Object.fromEntries(
      METERS.map((meter) => [
        meter,
        // Speech is kept to the second and shown in started minutes.
        meter === "audioMinutes" ? Math.ceil((row?.audioSeconds ?? 0) / 60) : (row?.[meter] ?? 0),
      ]),
    ) as Record<Meter, number>;
  };

  return {
    async current(now: Date = new Date()): Promise<Entitlements> {
      const period = usagePeriod(now, await timeZone(db));
      const [{ own, plan: current }, counts, row] = await Promise.all([
        plan(db),
        used(db, period),
        counters(db, period),
      ]);
      return {
        plan: current,
        subscription: own,
        period,
        used: counts,
        spokenSeconds: row?.audioSeconds ?? 0,
      };
    },

    /** One unit of a meter, if this month's allowance has one left. */
    async take(meter: UnitMeter, now: Date = new Date()): Promise<Taken> {
      const period = usagePeriod(now, await timeZone(db));
      const { plan: current } = await plan(db);
      const limit = current.allowance[meter];
      const column = COLUMNS[meter];
      if (limit !== null && limit < 1) return { ok: false, used: 0, limit, period };
      const [row] = await db
        .insert(usageCounters)
        .values({ userId, period: period.start, [meter]: 1 })
        .onConflictDoUpdate({
          target: [usageCounters.userId, usageCounters.period],
          set: { [meter]: sql`${column} + 1`, updatedAt: new Date() },
          ...(limit === null ? {} : { setWhere: sql`${column} < ${limit}` }),
        })
        .returning({ used: column });
      if (row) return { ok: true, used: row.used, limit, period };
      return { ok: false, used: (await used(db, period))[meter], limit, period };
    },

    /** Give a unit back to the month it was taken from, after a call that failed. */
    async giveBack(meter: UnitMeter, period: UsagePeriod): Promise<void> {
      const column = COLUMNS[meter];
      await db
        .update(usageCounters)
        .set({ [meter]: sql`greatest(${column} - 1, 0)`, updatedAt: new Date() })
        .where(and(eq(usageCounters.userId, userId), eq(usageCounters.period, period.start)));
    },

    /**
     * Seconds of speech for one recording, taken before the house transcribes
     * it, in the same statement that checks the month: refused once the
     * month's minutes are used. A recording that started with time left is
     * taken whole, even if it ends past the limit, so words already spoken are
     * never thrown away halfway; the browser stops recording when the month's
     * time runs out, so the month is passed by one recording at most.
     */
    async takeAudio(seconds: number, now: Date = new Date()): Promise<TakenAudio> {
      const amount = Math.max(1, Math.ceil(seconds));
      const period = usagePeriod(now, await timeZone(db));
      const { plan: current } = await plan(db);
      const minutes = current.allowance.audioMinutes;
      const limitSeconds = minutes === null ? null : minutes * 60;
      if (limitSeconds !== null && limitSeconds < 1) {
        return { ok: false, usedSeconds: 0, limitSeconds, seconds: 0, period };
      }
      const column = usageCounters.audioSeconds;
      const [row] = await db
        .insert(usageCounters)
        .values({ userId, period: period.start, audioSeconds: amount })
        .onConflictDoUpdate({
          target: [usageCounters.userId, usageCounters.period],
          set: { audioSeconds: sql`${column} + ${amount}`, updatedAt: new Date() },
          ...(limitSeconds === null ? {} : { setWhere: sql`${column} < ${limitSeconds}` }),
        })
        .returning({ used: column });
      if (row) return { ok: true, usedSeconds: row.used, limitSeconds, seconds: amount, period };
      const month = await counters(db, period);
      return { ok: false, usedSeconds: month?.audioSeconds ?? 0, limitSeconds, seconds: 0, period };
    },

    /**
     * Settle a recording against what was really transcribed: give back what
     * was taken for a call that failed (`actual` 0), or the difference when
     * the provider counted less, or add what it counted beyond the estimate.
     */
    async settleAudio(period: UsagePeriod, taken: number, actual: number): Promise<void> {
      const delta = Math.max(0, Math.ceil(actual)) - taken;
      if (delta === 0) return;
      const column = usageCounters.audioSeconds;
      await db
        .update(usageCounters)
        .set({ audioSeconds: sql`greatest(${column} + ${delta}, 0)`, updatedAt: new Date() })
        .where(and(eq(usageCounters.userId, userId), eq(usageCounters.period, period.start)));
    },

    /** The account's own subscription of this kind, whatever its status. */
    async subscription(kind: SubscriptionKind): Promise<Subscription | null> {
      const row = await ownRow(db, kind);
      return row ? decodeSubscription(row) : null;
    },

    /**
     * The payment provider's customer for this account, if it was one: a new
     * subscription reuses it, and its billing page opens with it. Server side only.
     */
    async customer(): Promise<string | null> {
      const rows = await db
        .select({ customer: subscriptions.providerCustomerId })
        .from(subscriptions)
        .where(and(eq(subscriptions.userId, userId), sql`${subscriptions.providerCustomerId} is not null`))
        .orderBy(sql`${subscriptions.updatedAt} desc`)
        .limit(1);
      return rows[0]?.customer ?? null;
    },
  };
}
