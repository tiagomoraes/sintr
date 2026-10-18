import type { BaseRuntime } from "@sintr/core/runtime/base";
import type { Job } from "./scheduler";

const HOUR = 60 * 60 * 1000;

/**
 * The worker's jobs. Report generation, sending and retention arrive with
 * their milestones (F2, F5); F0 only keeps auth records tidy.
 */
export const JOBS: readonly Job<BaseRuntime>[] = [
  {
    name: "purge-expired-auth-records",
    intervalMs: HOUR,
    run: (runtime) => runtime.purgeExpiredAuthRecords(),
  },
];
