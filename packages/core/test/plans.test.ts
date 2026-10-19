import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { setPersonPlan } from "../src/billing/subscriptions";
import { subscriptions, usageCounters, users } from "../src/db/schema";
import { PERSON_PLANS } from "../src/domain";
import { InvalidStateError, NotFoundError } from "../src/errors";
import { setPracticePlan } from "../src/practice/plan";
import { createRepositories, resolvePlan, usagePeriod, type UserScope } from "../src/repositories";
import { createUser, openTestDatabase, testMasterKey } from "./support";

/**
 * F5: plans and the house assistant's meter. Against a real Postgres: the
 * plan a person holds, the month in their own calendar, units taken and
 * refused at the limit in one statement, given back after a failure, and
 * the admin path for a person's plan.
 */

const handle = openTestDatabase();
const repositories = createRepositories(handle.db, testMasterKey);
const OCT = new Date("2026-10-19T15:00:00Z");

afterAll(() => handle.close());

async function account(label: string, timezone = "America/Sao_Paulo"): Promise<UserScope> {
  const id = await createUser(handle.db, label);
  await repositories.provision(id);
  const scope = await repositories.forUser(id);
  await scope.profile.update({ timezone });
  return scope;
}

async function emailOf(scope: UserScope): Promise<string> {
  const [row] = await handle.db.select({ email: users.email }).from(users).where(eq(users.id, scope.userId));
  return row!.email;
}

/** Fill a meter to `used` directly, as a month of conversations would. */
async function used(scope: UserScope, period: string, assistantMessages: number, reports = 0) {
  await handle.db
    .insert(usageCounters)
    .values({ userId: scope.userId, period, assistantMessages, reports })
    .onConflictDoUpdate({
      target: [usageCounters.userId, usageCounters.period],
      set: { assistantMessages, reports },
    });
}

describe("the month of the meter", () => {
  it("is the person's own calendar month, named by its first day", () => {
    expect(usagePeriod(OCT, "America/Sao_Paulo")).toEqual({ start: "2026-10-01", next: "2026-11-01" });
    // 31 October at 23:30 in Sao Paulo is already November in UTC, and still October for the person.
    const lateOctober = new Date("2026-11-01T02:30:00Z");
    expect(usagePeriod(lateOctober, "America/Sao_Paulo").start).toBe("2026-10-01");
    expect(usagePeriod(lateOctober, "UTC").start).toBe("2026-11-01");
    expect(usagePeriod(new Date("2026-12-31T12:00:00Z"), "UTC")).toEqual({
      start: "2026-12-01",
      next: "2027-01-01",
    });
    // A zone that cannot be read falls back to UTC instead of failing a conversation.
    expect(usagePeriod(OCT, "Not/AZone").start).toBe("2026-10-01");
  });
});

describe("the plan a person holds", () => {
  it("is the installation's, unless a grant, a subscription or a practice's plan gives more", () => {
    const free = { installation: "free" as const, own: null, practiceSeats: null };
    expect(resolvePlan(free)).toMatchObject({ id: "free", label: "Free", source: "installation" });
    expect(resolvePlan({ ...free, installation: "unlimited" })).toMatchObject({
      id: "unlimited",
      source: "installation",
    });
    const paid = { plan: "personal", status: "active", source: "stripe" } as const;
    expect(resolvePlan({ ...free, own: paid })).toMatchObject({ id: "personal", source: "subscription" });
    // A payment being retried keeps the plan; a cancelled or unpaid one does not.
    expect(resolvePlan({ ...free, own: { ...paid, status: "past_due" } }).id).toBe("personal");
    expect(resolvePlan({ ...free, own: { ...paid, status: "trialing" } }).id).toBe("personal");
    for (const status of ["canceled", "unpaid", "incomplete", "incomplete_expired", "paused"] as const) {
      expect(resolvePlan({ ...free, own: { ...paid, status } }).id).toBe("free");
    }
    expect(
      resolvePlan({ ...free, own: { plan: "unlimited", status: "active", source: "grant" } }),
    ).toMatchObject({
      id: "unlimited",
      source: "grant",
    });
    // A practice with a plan of its own includes Personal for the professional's own diary.
    expect(resolvePlan({ ...free, practiceSeats: "subscription" })).toMatchObject({
      id: "personal",
      source: "practice",
    });
    expect(resolvePlan({ ...free, practiceSeats: "grant" })).toMatchObject({ source: "practice" });
    expect(resolvePlan({ ...free, practiceSeats: "config" })).toMatchObject({ id: "free" });
    // Paying for Personal and holding a practice plan: the person's own subscription is the one shown.
    expect(resolvePlan({ ...free, own: paid, practiceSeats: "subscription" })).toMatchObject({
      source: "subscription",
    });
    // An installation default above Personal is never lowered by a subscription.
    expect(resolvePlan({ ...free, installation: "unlimited", own: paid }).id).toBe("unlimited");
  });

  it("is read with the month's use, in the person's time zone", async () => {
    const ana = await account("plan-ana");
    const now = await ana.plans.current(OCT);
    expect(now).toEqual({
      plan: { id: "free", label: "Free", source: "installation", allowance: PERSON_PLANS.free.allowance },
      subscription: null,
      period: { start: "2026-10-01", next: "2026-11-01" },
      used: { assistantMessages: 0, reports: 0, audioMinutes: 0 },
    });
    await used(ana, "2026-10-01", 12, 1);
    expect((await ana.plans.current(OCT)).used).toEqual({
      assistantMessages: 12,
      reports: 1,
      audioMinutes: 0,
    });
    // November starts at zero.
    expect((await ana.plans.current(new Date("2026-11-02T12:00:00Z"))).used.assistantMessages).toBe(0);
  });

  it("follows the installation's default plan", async () => {
    const generous = createRepositories(handle.db, testMasterKey, { personPlan: "unlimited" });
    const id = await createUser(handle.db, "plan-unlimited");
    await generous.provision(id);
    const scope = await generous.forUser(id);
    expect((await scope.plans.current(OCT)).plan).toMatchObject({ id: "unlimited", label: "Unlimited" });
    // No limit, and still counted, so whoever runs it can see the use.
    for (let i = 0; i < 3; i += 1) expect((await scope.plans.take("assistantMessages", OCT)).ok).toBe(true);
    expect(await scope.plans.take("assistantMessages", OCT)).toMatchObject({
      ok: true,
      used: 4,
      limit: null,
    });
  });
});

describe("taking from the meter", () => {
  it("counts each unit and refuses at the month's limit, without counting the refusal", async () => {
    const bia = await account("take-bia");
    const limit = PERSON_PLANS.free.allowance.assistantMessages!;
    expect(await bia.plans.take("assistantMessages", OCT)).toMatchObject({
      ok: true,
      used: 1,
      limit,
      period: { start: "2026-10-01" },
    });
    await used(bia, "2026-10-01", limit - 1);
    expect(await bia.plans.take("assistantMessages", OCT)).toMatchObject({ ok: true, used: limit });
    expect(await bia.plans.take("assistantMessages", OCT)).toMatchObject({ ok: false, used: limit, limit });
    expect(await bia.plans.take("assistantMessages", OCT)).toMatchObject({ ok: false, used: limit });
    // Reports are a meter of their own.
    expect(await bia.plans.take("reports", OCT)).toMatchObject({ ok: true, used: 1 });
    // The next month starts again.
    expect(await bia.plans.take("assistantMessages", new Date("2026-11-03T12:00:00Z"))).toMatchObject({
      ok: true,
      used: 1,
      period: { start: "2026-11-01" },
    });
  });

  it("never lets parallel requests pass the limit", async () => {
    const cris = await account("take-parallel");
    const limit = PERSON_PLANS.free.allowance.reports!;
    const results = await Promise.all(
      Array.from({ length: limit * 5 }, () => cris.plans.take("reports", OCT)),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(limit);
    expect((await cris.plans.current(OCT)).used.reports).toBe(limit);
  });

  it("gives a unit back to the month it came from, and never below zero", async () => {
    const duda = await account("give-back");
    const taken = await duda.plans.take("assistantMessages", OCT);
    expect(taken.used).toBe(1);
    // Given back after midnight on the last day: it still goes to the month it was taken from.
    await duda.plans.giveBack("assistantMessages", taken.period);
    await duda.plans.giveBack("assistantMessages", taken.period);
    expect((await duda.plans.current(OCT)).used.assistantMessages).toBe(0);
  });

  it("cannot start a month twice by changing time zone", async () => {
    const eli = await account("zone-hop", "UTC");
    const limit = PERSON_PLANS.free.allowance.assistantMessages!;
    const lateOctober = new Date("2026-10-31T23:30:00Z");
    await used(eli, "2026-10-01", limit);
    expect((await eli.plans.take("assistantMessages", lateOctober)).ok).toBe(false);
    // Moving to a zone where it is already November opens November's count, which is then used.
    await eli.profile.update({ timezone: "Pacific/Kiritimati" });
    expect(await eli.plans.take("assistantMessages", lateOctober)).toMatchObject({
      ok: true,
      period: { start: "2026-11-01" },
    });
    await eli.profile.update({ timezone: "UTC" });
    expect((await eli.plans.take("assistantMessages", lateOctober)).ok).toBe(false);
    expect((await eli.plans.current(new Date("2026-11-02T00:00:00Z"))).used.assistantMessages).toBe(1);
  });

  it("is scoped to the person: one account's use is never another's", async () => {
    const one = await account("scope-one");
    const two = await account("scope-two");
    await used(one, "2026-10-01", 40);
    expect((await two.plans.current(OCT)).used.assistantMessages).toBe(0);
    await two.plans.take("assistantMessages", OCT);
    await two.plans.giveBack("assistantMessages", usagePeriod(OCT, "America/Sao_Paulo"));
    expect((await one.plans.current(OCT)).used.assistantMessages).toBe(40);
  });
});

describe("spoken minutes", () => {
  const FREE = PERSON_PLANS.free.allowance.audioMinutes! * 60;

  async function spoken(scope: UserScope, period: string, audioSeconds: number) {
    await handle.db
      .insert(usageCounters)
      .values({ userId: scope.userId, period, audioSeconds })
      .onConflictDoUpdate({ target: [usageCounters.userId, usageCounters.period], set: { audioSeconds } });
  }

  it("are counted to the second, and shown in started minutes", async () => {
    const ivo = await account("audio-ivo");
    expect(await ivo.plans.takeAudio(12.2, OCT)).toMatchObject({
      ok: true,
      usedSeconds: 13,
      limitSeconds: FREE,
      seconds: 13,
      period: { start: "2026-10-01" },
    });
    expect((await ivo.plans.current(OCT)).used.audioMinutes).toBe(1);
    expect(await ivo.plans.takeAudio(50, OCT)).toMatchObject({ ok: true, usedSeconds: 63 });
    expect((await ivo.plans.current(OCT)).used.audioMinutes).toBe(2);
    // Messages are a meter of their own.
    expect((await ivo.plans.current(OCT)).used.assistantMessages).toBe(0);
  });

  it("take a recording whole when it starts with time left, and refuse the next one", async () => {
    const jo = await account("audio-limit");
    await spoken(jo, "2026-10-01", FREE - 5);
    // Five seconds were left; the words already spoken are not cut.
    expect(await jo.plans.takeAudio(40, OCT)).toMatchObject({ ok: true, usedSeconds: FREE + 35 });
    expect(await jo.plans.takeAudio(3, OCT)).toMatchObject({ ok: false, usedSeconds: FREE + 35, seconds: 0 });
    // The next month starts again.
    expect((await jo.plans.takeAudio(3, new Date("2026-11-02T12:00:00Z"))).ok).toBe(true);
  });

  it("never let parallel recordings start past the limit", async () => {
    const leo = await account("audio-parallel");
    await spoken(leo, "2026-10-01", FREE - 1);
    const results = await Promise.all(Array.from({ length: 10 }, () => leo.plans.takeAudio(30, OCT)));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  it("settle against what the provider counted, and give it all back after a failure", async () => {
    const mia = await account("audio-settle");
    const taken = await mia.plans.takeAudio(60, OCT);
    // The provider heard 41 seconds: the rest goes back.
    await mia.plans.settleAudio(taken.period, taken.seconds, 41);
    expect((await mia.plans.current(OCT)).used.audioMinutes).toBe(1);
    const again = await mia.plans.takeAudio(10, OCT);
    expect(again.usedSeconds).toBe(51);
    // The provider heard more than the browser said: it is counted.
    await mia.plans.settleAudio(again.period, again.seconds, 30);
    const failed = await mia.plans.takeAudio(20, OCT);
    expect(failed.usedSeconds).toBe(91);
    // A failed call gives back what it took, and never goes below zero.
    await mia.plans.settleAudio(failed.period, failed.seconds, 0);
    await mia.plans.settleAudio(failed.period, 500, 0);
    expect((await mia.plans.current(OCT)).used.audioMinutes).toBe(0);
  });

  it("have no limit on Unlimited, and are still counted", async () => {
    const generous = createRepositories(handle.db, testMasterKey, { personPlan: "unlimited" });
    const id = await createUser(handle.db, "audio-unlimited");
    await generous.provision(id);
    const scope = await generous.forUser(id);
    await spoken(scope, "2026-10-01", 100_000);
    expect(await scope.plans.takeAudio(60, OCT)).toMatchObject({
      ok: true,
      limitSeconds: null,
      usedSeconds: 100_060,
    });
  });
});

describe("the admin path for a person's plan", () => {
  it("grants Personal or Unlimited by email, and returns to the installation's plan", async () => {
    const fia = await account("grant-fia");
    const email = await emailOf(fia);
    await setPersonPlan(handle.db, { email: email.toUpperCase(), plan: "personal" });
    expect(await fia.plans.current(OCT)).toMatchObject({
      plan: { id: "personal", source: "grant" },
      subscription: {
        kind: "person",
        plan: "personal",
        status: "active",
        source: "grant",
        hasCustomer: false,
      },
    });
    await setPersonPlan(handle.db, { email, plan: "unlimited" });
    expect((await fia.plans.current(OCT)).plan).toMatchObject({ id: "unlimited", source: "grant" });
    await setPersonPlan(handle.db, { email, plan: null });
    expect(await fia.plans.current(OCT)).toMatchObject({ plan: { id: "free" }, subscription: null });
    expect((await fia.auditLog.list()).filter((e) => e.action === "plan.changed")).toHaveLength(3);
    await expect(
      setPersonPlan(handle.db, { email: "nobody@example.test", plan: null }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("does not overwrite a plan the person pays for", async () => {
    const gil = await account("grant-paid");
    await handle.db.insert(subscriptions).values({
      userId: gil.userId,
      kind: "person",
      plan: "personal",
      status: "active",
      source: "stripe",
      providerCustomerId: "cus_gil",
      providerSubscriptionId: `sub_gil_${gil.userId}`,
    });
    await expect(
      setPersonPlan(handle.db, { email: await emailOf(gil), plan: "unlimited" }),
    ).rejects.toBeInstanceOf(InvalidStateError);
    expect(await gil.plans.customer()).toBe("cus_gil");
    // Once that subscription ended, a grant may replace it; the customer stays known.
    await handle.db
      .update(subscriptions)
      .set({ status: "canceled" })
      .where(and(eq(subscriptions.userId, gil.userId), eq(subscriptions.kind, "person")));
    await setPersonPlan(handle.db, { email: await emailOf(gil), plan: "unlimited" });
    expect((await gil.plans.current(OCT)).plan.id).toBe("unlimited");
    expect(await gil.plans.customer()).toBe("cus_gil");
  });

  it("includes Personal for a professional whose practice has a plan of its own", async () => {
    const hosted = createRepositories(handle.db, testMasterKey, {
      practiceDefaults: { plan: "Free", seats: 1 },
    });
    const id = await createUser(handle.db, "plan-practice");
    await hosted.provision(id);
    const pro = await hosted.forUser(id);
    await pro.practice.open({ professionalName: "Dr. Plan" });
    expect((await pro.plans.current(OCT)).plan.id).toBe("free");
    await setPracticePlan(handle.db, { email: await emailOf(pro), grant: { plan: "Practice 5", seats: 5 } });
    expect((await pro.plans.current(OCT)).plan).toMatchObject({ id: "personal", source: "practice" });
    await setPracticePlan(handle.db, { email: await emailOf(pro), grant: null });
    expect((await pro.plans.current(OCT)).plan.id).toBe("free");
  });
});
