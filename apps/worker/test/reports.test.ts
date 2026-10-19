import { randomUUID } from "node:crypto";
import {
  HEALTH_DATA_CONSENT_VERSION,
  createLogger,
  generateMasterKey,
  loadConfig,
  memoryTransport,
  parseContent,
  zonedTime,
  type UserScope,
} from "@sintr/core";
import { createDatabase } from "@sintr/core/db";
import { createBaseRuntime } from "@sintr/core/runtime/base";
import { users } from "@sintr/core/schema";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { prepareDueReports } from "../src/reports";
import { createScheduler, type Clock, type Job } from "../src/scheduler";

/**
 * The scheduling of reports, against a real Postgres, with the offline
 * rehearsal model (SINTR_FAKE_AGENT) and the in-process email transport:
 * no network, no key. The clock is whatever the test says it is.
 */

const email = memoryTransport();
const runtime = createBaseRuntime(
  loadConfig({
    DATABASE_URL: inject("databaseUrl"),
    SINTR_AUTH_SECRET: randomUUID() + randomUUID(),
    SINTR_MASTER_KEY: generateMasterKey(),
    SINTR_FAKE_AGENT: "1",
    SINTR_LOG_LEVEL: "error",
  }),
  { service: "test", poolSize: 2, email },
);
const handle = createDatabase(inject("databaseUrl"), { max: 1 });

async function person(label: string, verified: boolean): Promise<UserScope> {
  const id = `${label}-${randomUUID()}`;
  await handle.db.insert(users).values({ id, email: `${id}@example.test`, emailVerified: verified });
  await runtime.repositories.provision(id);
  const scope = await runtime.repositories.forUser(id);
  // As at sign-up: the consent to process health data, current wording.
  await scope.consents.record({
    purpose: "health_data_processing",
    version: HEALTH_DATA_CONSENT_VERSION,
    granted: true,
  });
  return scope;
}

const SP = "America/Sao_Paulo";
const sp = (month: number, day: number, hour: number, minute = 0) =>
  zonedTime({ year: 2026, month, day, hour, minute }, SP);

let alice: UserScope;
let bob: UserScope;

beforeAll(async () => {
  // Alice: São Paulo, Mondays at 18:00, an assistant, and the notice by email.
  alice = await person("alice", true);
  await alice.profile.update({ timezone: SP, locale: "pt-BR", displayName: "Alice" });
  await alice.therapySettings.update({
    sessionDay: 1,
    sessionTime: "18:00",
    reportLeadMinutes: 60,
    reportNoticeEmail: true,
  });
  await alice.agentSettings.update({
    provider: "anthropic",
    model: "a-model",
    apiKey: "sk-test-key-not-real-0000",
  });
  await alice.entries.create({
    occurredAt: sp(10, 15, 16),
    title: "Conversa com a coordenadora",
    situation: "conversa a sós sobre os prazos",
    thoughts: ["eu sempre deixo a desejar"],
    emotions: [{ name: "ansiedade", intensity: 65 }],
  });
  await alice.checkins.create({
    occurredAt: sp(10, 16, 9),
    mood: 4,
    anxiety: 2,
    sleepHours: 7,
    note: "dormi bem",
  });
  // Bob: Tokyo, Mondays at 18:00 there, no assistant, no notice.
  bob = await person("bob", true);
  await bob.profile.update({ timezone: "Asia/Tokyo" });
  await bob.therapySettings.update({ sessionDay: 1, sessionTime: "18:00", reportLeadMinutes: 120 });
});

afterAll(async () => {
  await runtime.close();
  await handle.close();
});

describe("preparing reports on schedule", () => {
  it("waits until report_lead before each person's session, in their own time zone", async () => {
    // Monday 19 October, 16:59 in São Paulo (19:59 UTC): Bob's session in Tokyo (09:00 UTC) is over.
    expect(await prepareDueReports(runtime, sp(10, 19, 16, 59))).toEqual({ prepared: 0, failed: 0 });
    expect(await alice.reports.list()).toEqual([]);
    expect(await bob.reports.list()).toEqual([]);
  });

  it("prepares the draft one report_lead before the session, and tells the person by email", async () => {
    expect(await prepareDueReports(runtime, sp(10, 19, 17))).toEqual({ prepared: 1, failed: 0 });
    const [report] = await alice.reports.list();
    expect(report).toMatchObject({
      status: "draft",
      periodStart: sp(10, 12, 17),
      periodEnd: sp(10, 19, 17),
      sessionAt: sp(10, 19, 18),
      editedAt: null,
    });
    const content = parseContent(report!.content)!;
    expect(content.author).toBe("assistant");
    expect(content.language).toBe("pt");
    expect(content.moments.map((m) => m.thoughts)).toEqual([["eu sempre deixo a desejar"]]);
    expect(content.notes.map((n) => n.note)).toEqual(["dormi bem"]);

    const notice = email.sent.at(-1)!;
    expect(notice.to).toMatch(/^alice-.*@example\.test$/u);
    expect(notice.text).toContain(`/reports/${report!.id}`);
    expect(notice.text).not.toContain("eu sempre deixo a desejar");
    expect(notice.attachments).toBeUndefined();
    expect((await alice.reports.get(report!.id))?.notifiedAt).not.toBeNull();
    // Nothing went to the therapist: there is no consent and no send.
    expect((await alice.consents.list()).filter((c) => c.purpose === "report_send")).toEqual([]);
  });

  it("prepares each report once, however often it runs", async () => {
    const sent = email.sent.length;
    expect(await prepareDueReports(runtime, sp(10, 19, 17, 1))).toEqual({ prepared: 0, failed: 0 });
    expect(await prepareDueReports(runtime, sp(10, 19, 17, 30))).toEqual({ prepared: 0, failed: 0 });
    expect(await alice.reports.list()).toHaveLength(1);
    expect(email.sent.length).toBe(sent);
  });

  it("follows a session that moves: the untouched draft is prepared again for the new day", async () => {
    // Before Monday's session, Alice moves her sessions to Wednesdays at 18:00, and writes on Tuesday.
    await alice.therapySettings.update({ sessionDay: 3 });
    await alice.checkins.create({ occurredAt: sp(10, 20, 9), mood: 3, note: "terça mais calma" });
    expect(await prepareDueReports(runtime, sp(10, 21, 16, 59))).toEqual({ prepared: 0, failed: 0 });
    expect(await prepareDueReports(runtime, sp(10, 21, 17))).toEqual({ prepared: 1, failed: 0 });
    const reports = await alice.reports.list();
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      periodStart: sp(10, 12, 17),
      periodEnd: sp(10, 21, 17),
      sessionAt: sp(10, 21, 18),
    });
    expect((await alice.reports.revisions(reports[0]!.id)).map((r) => r.kind)).toEqual(["prepared_again"]);
    expect(parseContent(reports[0]!.content)!.notes.map((n) => n.note)).toEqual([
      "dormi bem",
      "terça mais calma",
    ]);
  });

  it("starts the next report exactly where the last one ended", async () => {
    expect(await prepareDueReports(runtime, sp(10, 28, 17))).toMatchObject({ prepared: 1 });
    const [latest, previous] = await alice.reports.list();
    expect(latest!.periodStart).toEqual(previous!.periodEnd);
    expect(latest!.periodEnd).toEqual(sp(10, 28, 17));
  });

  it("prepares what sintr can alone when there is no assistant, and sends no notice nobody asked for", async () => {
    const sent = email.sent.length;
    // Bob: Monday 26 October 18:00 in Tokyo is 09:00 UTC; two hours before is 07:00 UTC.
    expect(await prepareDueReports(runtime, new Date("2026-10-26T06:59:00Z"))).toMatchObject({ prepared: 0 });
    expect(await prepareDueReports(runtime, new Date("2026-10-26T07:00:00Z"))).toMatchObject({ prepared: 1 });
    const [report] = await bob.reports.list();
    expect(report).toMatchObject({
      sessionAt: new Date("2026-10-26T09:00:00Z"),
      periodEnd: new Date("2026-10-26T07:00:00Z"),
    });
    expect(parseContent(report!.content)).toMatchObject({
      author: "sintr",
      problem: "not_configured",
      week: "",
    });
    expect(email.sent.length).toBe(sent);
  });

  it("prepares nothing for a person whose consent to process their data is withdrawn or outdated", async () => {
    const erin = await person("erin", true);
    await erin.therapySettings.update({ sessionDay: 1, sessionTime: "21:00" });
    await erin.consents.record({
      purpose: "health_data_processing",
      version: HEALTH_DATA_CONSENT_VERSION,
      granted: false,
    });
    const frank = await person("frank", true);
    await frank.therapySettings.update({ sessionDay: 1, sessionTime: "21:00" });
    await frank.consents.record({ purpose: "health_data_processing", version: "2000-01-01", granted: true });
    const scheduled = (await runtime.reportSchedules()).map((p) => p.userId);
    expect(scheduled).not.toContain(erin.userId);
    expect(scheduled).not.toContain(frank.userId);
    expect(scheduled).toContain(alice.userId);
  });

  it("keeps going when one person's preparation fails", async () => {
    // Carol and Dan (both in UTC) have their sessions on Mondays at 20:00; only Carol's fails.
    const carol = await person("carol", false);
    const dan = await person("dan", false);
    for (const scope of [carol, dan])
      await scope.therapySettings.update({ sessionDay: 1, sessionTime: "20:00" });
    const lines: string[] = [];
    const log = createLogger({ write: (_level, line) => lines.push(line) });
    const result = await prepareDueReports({ ...runtime, log }, new Date("2026-11-02T19:00:00Z"), {
      modelFor: async (scope) => {
        if (scope.userId === carol.userId) throw new Error("the entry said: eu sempre deixo a desejar");
        return { model: null, problem: "not_configured" };
      },
    });
    expect(result).toEqual({ prepared: 1, failed: 1 });
    // The failure is logged by name, never by its words.
    const failure = lines.find((line) => line.includes("report.prepare_failed"));
    expect(failure).toContain('"errorName":"Error"');
    expect(lines.join("\n")).not.toContain("deixo a desejar");
    expect(await carol.reports.list()).toEqual([]);
    expect(await dan.reports.list()).toHaveLength(1);
  });
});

/** A clock the test moves by hand. */
function manualClock(start: Date) {
  let now = start.getTime();
  const timers = new Set<{ every: number; next: number; fn: () => void }>();
  const clock: Clock & { advance(ms: number): void } = {
    now: () => new Date(now),
    every(ms, fn) {
      const timer = { every: ms, next: now + ms, fn };
      timers.add(timer);
      return () => timers.delete(timer);
    },
    advance(ms) {
      const target = now + ms;
      for (;;) {
        const due = [...timers].filter((t) => t.next <= target).sort((a, b) => a.next - b.next)[0];
        if (!due) break;
        now = due.next;
        due.next += due.every;
        due.fn();
      }
      now = target;
    },
  };
  return clock;
}

describe("the scheduler's clock", () => {
  it("runs the jobs at the clock's moments, so time can be injected", async () => {
    const clock = manualClock(new Date("2026-10-19T19:58:00Z"));
    const seen: string[] = [];
    const job: Job<null> = {
      name: "watch",
      intervalMs: 60_000,
      run: async (_context, now) => void seen.push(now.toISOString()),
    };
    const scheduler = createScheduler([job], null, runtime.log, clock);
    scheduler.start();
    await scheduler.idle();
    clock.advance(60_000);
    await scheduler.idle();
    clock.advance(60_000);
    await scheduler.idle();
    await scheduler.stop();
    expect(seen).toEqual([
      "2026-10-19T19:58:00.000Z",
      "2026-10-19T19:59:00.000Z",
      "2026-10-19T20:00:00.000Z",
    ]);
  });
});
