import { createLogger } from "@sintr/core";
import { describe, expect, it } from "vitest";
import { JOBS } from "../src/jobs";
import { createScheduler, type Job } from "../src/scheduler";

function capture() {
  const lines: Record<string, unknown>[] = [];
  const log = createLogger({
    write: (_level, line) => lines.push(JSON.parse(line) as Record<string, unknown>),
  });
  return { log, lines };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("scheduler", () => {
  it("runs each job at start and then on its interval", async () => {
    const { log } = capture();
    let runs = 0;
    const job: Job<null> = { name: "count", intervalMs: 20, run: async () => void (runs += 1) };
    const scheduler = createScheduler([job], null, log);
    scheduler.start();
    await wait(70);
    await scheduler.stop();
    expect(runs).toBeGreaterThanOrEqual(3);
  });

  it("never overlaps a job with itself", async () => {
    const { log } = capture();
    let active = 0;
    let maxActive = 0;
    const job: Job<null> = {
      name: "slow",
      intervalMs: 5,
      run: async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await wait(30);
        active -= 1;
      },
    };
    const scheduler = createScheduler([job], null, log);
    scheduler.start();
    await wait(80);
    await scheduler.stop();
    expect(maxActive).toBe(1);
  });

  it("logs a failure by name and code only, and keeps going", async () => {
    const { log, lines } = capture();
    let runs = 0;
    const job: Job<null> = {
      name: "fails",
      intervalMs: 15,
      run: async () => {
        runs += 1;
        throw Object.assign(new Error("row contained 'my private thought'"), { code: "XX000" });
      },
    };
    const scheduler = createScheduler([job], null, log);
    scheduler.start();
    await wait(50);
    await scheduler.stop();
    expect(runs).toBeGreaterThanOrEqual(2);
    const failure = lines.find((line) => line.event === "job.failed");
    expect(failure).toMatchObject({ job: "fails", errorName: "Error", errorCode: "XX000" });
    expect(JSON.stringify(lines)).not.toContain("private thought");
  });

  it("logs the total of a job's counts", async () => {
    const { log, lines } = capture();
    const scheduler = createScheduler(
      [{ name: "c", intervalMs: 1000, run: async () => ({ a: 2, b: 3 }) }],
      null,
      log,
    );
    scheduler.start();
    await scheduler.stop();
    expect(lines.find((line) => line.event === "job.done")).toMatchObject({ job: "c", count: 5 });
  });

  it("stops scheduling after stop()", async () => {
    const { log } = capture();
    let runs = 0;
    const scheduler = createScheduler(
      [{ name: "x", intervalMs: 10, run: async () => void (runs += 1) }],
      null,
      log,
    );
    scheduler.start();
    await scheduler.stop();
    const after = runs;
    await wait(40);
    expect(runs).toBe(after);
  });
});

describe("jobs", () => {
  it("prepares due reports every minute, at the scheduler's moment", async () => {
    const job = JOBS.find((j) => j.name === "prepare-reports");
    expect(job?.intervalMs).toBe(60 * 1000);
    const asked: Date[] = [];
    const fake = { reportSchedules: async (now: Date) => (asked.push(now), []) };
    const now = new Date("2026-10-19T20:00:00Z");
    expect(await job!.run(fake as never, now)).toEqual({ prepared: 0, failed: 0 });
    expect(asked).toEqual([now]);
  });

  it("purges expired auth records hourly through the runtime", async () => {
    const job = JOBS.find((j) => j.name === "purge-expired-auth-records");
    expect(job?.intervalMs).toBe(60 * 60 * 1000);
    const calls: string[] = [];
    const fake = {
      purgeExpiredAuthRecords: async () => (calls.push("purge"), { sessions: 2, verificationTokens: 0 }),
    };
    expect(await job!.run(fake as never, new Date())).toEqual({ sessions: 2, verificationTokens: 0 });
    expect(calls).toEqual(["purge"]);
  });

  it("purges conversations past their retention through the runtime", async () => {
    const job = JOBS.find((j) => j.name === "purge-expired-conversations");
    expect(job?.intervalMs).toBe(60 * 60 * 1000);
    const calls: string[] = [];
    const fake = {
      purgeExpiredConversations: async () => (calls.push("purge"), { conversations: 3 }),
    };
    expect(await job!.run(fake as never, new Date())).toEqual({ conversations: 3 });
    expect(calls).toEqual(["purge"]);
  });
});
