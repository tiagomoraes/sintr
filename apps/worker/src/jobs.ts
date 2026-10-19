import type { BaseRuntime } from "@sintr/core/runtime/base";
import { prepareDueReports } from "./reports";
import type { Job } from "./scheduler";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/**
 * The worker's jobs. Housekeeping spans every person by nature, so it reads
 * no content: it deletes by date and counts what it removed. The report job
 * opens one person's scope at a time, and only to prepare their own draft.
 * The practice notice reads ids, flags and the professional's address.
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
  {
    // Invites a month past being usable (accepted, revoked or expired).
    name: "purge-stale-invites",
    intervalMs: HOUR,
    run: (runtime, now) => runtime.purgeStaleInvites(now),
  },
  {
    // Each person's report, one report_lead before their session. Every
    // minute, deciding from the schedule as it is now, so a moved session
    // moves the preparation and a restart loses nothing.
    name: "prepare-reports",
    intervalMs: MINUTE,
    run: (runtime, now) => prepareDueReports(runtime, now),
  },
  {
    // Professionals who asked for it hear by email that a report arrived:
    // a link and a count, never who or what. Reads no content.
    name: "notify-practices",
    intervalMs: MINUTE,
    run: (runtime, now) => runtime.notifyPractices(now),
  },
];
