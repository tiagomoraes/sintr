import { rememberNow } from "@sintr/agent";
import type { BaseRuntime } from "@sintr/core/runtime/base";

/** What the memory job needs from the runtime. */
export type MemoryRuntime = Pick<BaseRuntime, "repositories" | "log" | "memoryWork"> & {
  config: Pick<BaseRuntime["config"], "mode" | "fakeAgent" | "house">;
};

/**
 * Read the next pages of each diary whose memory is on (DECISIONS 119): one
 * person's scope at a time, a few pages each, the newest first, with their
 * own key or the house's within its daily bound. Whether their consent
 * still names the providers that would read is checked for each person
 * before anything is sent. One person's failure does not stop the others.
 */
export async function readDiaries(
  runtime: MemoryRuntime,
  now: Date,
  options: { fetch?: typeof fetch } = {},
): Promise<{ read: number; kept: number; failed: number }> {
  const { log } = runtime;
  let read = 0;
  let kept = 0;
  let failed = 0;
  for (const userId of await runtime.memoryWork()) {
    try {
      const scope = await runtime.repositories.forUser(userId);
      const result = await rememberNow(
        {
          scope,
          config: runtime.config,
          log: log.child({ userId }),
          ...(options.fetch ? { fetch: options.fetch } : {}),
        },
        { now },
      );
      read += result.read;
      kept += result.kept;
    } catch (error) {
      failed += 1;
      log.error("memory.read_failed", { userId, error });
    }
  }
  return { read, kept, failed };
}
