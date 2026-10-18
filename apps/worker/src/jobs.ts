import type { BaseRuntime } from "@sintr/core/runtime/base";
import type { Job } from "./scheduler";

const HOUR = 60 * 60 * 1000;

/**
 * The worker's jobs. Report generation and sending arrive with F2. Jobs
 * span every person by nature, so they read no content: they delete by
 * date and count what they removed.
 */
export const JOBS: readonly Job<BaseRuntime>[] = [
  {
    name: "purge-expired-auth-records",
    intervalMs: HOUR,
    run: (runtime) => runtime.purgeExpiredAuthRecords(),
  },
  {
    // Conversations past the retention a person chose in Settings.
    name: "purge-expired-conversations",
    intervalMs: HOUR,
    run: (runtime) => runtime.purgeExpiredConversations(),
  },
];
