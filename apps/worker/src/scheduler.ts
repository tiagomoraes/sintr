import type { Logger } from "@sintr/core";

/** A unit of background work. Jobs log counts and codes, never content. */
export interface Job<Context> {
  readonly name: string;
  readonly intervalMs: number;
  /** `now` is the scheduler's clock, so a job can be tested at any moment. */
  run(context: Context, now: Date): Promise<Record<string, number> | void>;
}

/** Time, as the scheduler sees it. Tests pass a clock they move by hand. */
export interface Clock {
  now(): Date;
  every(ms: number, fn: () => void): () => void;
}

export const systemClock: Clock = {
  now: () => new Date(),
  every(ms, fn) {
    const timer = setInterval(fn, ms);
    // The worker keeps itself alive; timers must not delay its shutdown.
    timer.unref();
    return () => clearInterval(timer);
  },
};

export interface Scheduler {
  start(): void;
  /** Stop scheduling and wait for running jobs to finish. */
  stop(): Promise<void>;
  /** Wait for the runs in progress (tests). */
  idle(): Promise<void>;
}

/**
 * Runs each job once at start, then every `intervalMs`. A job never
 * overlaps itself; a failure is logged (name and code only) and the job
 * runs again at its next tick. No external cron: the jobs that act at a
 * moment (the report an hour before a session) run every minute and decide
 * from the data what is due, so a restart or a changed setting loses nothing.
 */
export function createScheduler<Context>(
  jobs: readonly Job<Context>[],
  context: Context,
  log: Logger,
  clock: Clock = systemClock,
): Scheduler {
  const cancels: (() => void)[] = [];
  const running = new Map<string, Promise<void>>();
  let stopped = false;

  const tick = (job: Job<Context>) => {
    if (stopped || running.has(job.name)) return;
    const started = Date.now();
    const run = Promise.resolve()
      .then(() => job.run(context, clock.now()))
      .then((counts) => {
        // Only allowlisted keys reach the log; report the total as `count`.
        const count = Object.values(counts ?? {}).reduce((sum, n) => sum + n, 0);
        log.info("job.done", { job: job.name, durationMs: Date.now() - started, count });
      })
      .catch((error: unknown) => log.error("job.failed", { job: job.name, error }))
      .finally(() => running.delete(job.name));
    running.set(job.name, run);
  };

  return {
    start() {
      for (const job of jobs) {
        tick(job);
        cancels.push(clock.every(job.intervalMs, () => tick(job)));
      }
    },
    async stop() {
      stopped = true;
      for (const cancel of cancels.splice(0)) cancel();
      await Promise.allSettled(running.values());
    },
    async idle() {
      await Promise.allSettled(running.values());
    },
  };
}
