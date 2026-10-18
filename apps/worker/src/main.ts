import { loadConfig } from "@sintr/core";
import { createBaseRuntime } from "@sintr/core/runtime/base";
import { JOBS } from "./jobs";
import { createScheduler } from "./scheduler";

const runtime = createBaseRuntime(loadConfig(), { service: "worker", poolSize: 2 });
const { log } = runtime;

async function waitForDatabase(): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    if (await runtime.ping()) return;
    log.warn("worker.waiting_for_database", { attempt });
    await new Promise((resolve) => setTimeout(resolve, Math.min(attempt, 10) * 1000));
  }
}

await waitForDatabase();
const scheduler = createScheduler(JOBS, runtime, log);
scheduler.start();
log.info("worker.started", { count: JOBS.length, mode: runtime.config.mode });

// Keep the process alive; the job timers are unref'd so shutdown is prompt.
const keepAlive = setInterval(() => undefined, 1 << 30);

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    log.info("worker.stopping", { code: signal });
    clearInterval(keepAlive);
    void scheduler
      .stop()
      .then(() => runtime.close())
      .then(() => process.exit(0));
  });
}
