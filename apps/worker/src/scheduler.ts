import type { Logger } from "@sintr/core";

/** A unit of background work. Jobs log counts and codes, never content. */
export interface Job<Context> {
  readonly name: string;
  readonly intervalMs: number;
  run(context: Context): Promise<Record<string, number> | void>;
}

export interface Scheduler {
  start(): void;
  /** Stop scheduling and wait for running jobs to finish. */
  stop(): Promise<void>;
}

/**
 * Runs each job once at start, then every `intervalMs`. A job never
 * overlaps itself; a failure is logged (name and code only) and the job
 * runs again at its next tick.
 */
export function createScheduler<Context>(
  jobs: readonly Job<Context>[],
  context: Context,
  log: Logger,
): Scheduler {
  const timers = new Set<ReturnType<typeof setInterval>>();
  const running = new Map<string, Promise<void>>();
  let stopped = false;

  const tick = (job: Job<Context>) => {
    if (stopped || running.has(job.name)) return;
    const started = Date.now();
    const run = job
      .run(context)
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
        const timer = setInterval(() => tick(job), job.intervalMs);
        timer.unref();
        timers.add(timer);
      }
    },
    async stop() {
      stopped = true;
      for (const timer of timers) clearInterval(timer);
      timers.clear();
      await Promise.allSettled(running.values());
    },
  };
}
