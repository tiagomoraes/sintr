import "server-only";
import {
  memorySection,
  memoryState,
  recall,
  rememberNow,
  type MemoryContext,
  type MemoryState,
  type Remembered,
} from "@sintr/agent";
import type { UserScope } from "@sintr/core";
import { runtime } from "./runtime";

export type { MemoryState };

/** The memory's context for this person: their scope, the installation's assistant, the redacting logger. */
export function memoryContext(scope: UserScope): MemoryContext {
  return { scope, config: runtime().config, log: runtime().log.child({ userId: scope.userId }) };
}

/** Whether this person's memory is on, and through whom. */
export function memoryStateFor(scope: UserScope): Promise<MemoryState> {
  return memoryState(scope, runtime().config);
}

/** Read the next pages of the diary now, while the person waits (Memory's "Read it now", and turning it on). */
export function readNow(scope: UserScope): Promise<Remembered> {
  return rememberNow(memoryContext(scope));
}

/**
 * What a conversation is told for one turn: the memories near the person's
 * words while it is on, or that it is off. Given to the driver, which asks
 * only after the crisis screen.
 */
export function memoryForTurn(scope: UserScope, timezone: string): (text: string) => Promise<string> {
  return async (text) => memorySection(await recall(memoryContext(scope), { text }), timezone);
}

/**
 * The name the person goes by, kept in step with the memory while they
 * have one (on or paused): a new name in the welcome is a new memory.
 */
export async function keepNameInMemory(scope: UserScope): Promise<void> {
  const consent = await scope.consents.latest("memory");
  if (!consent?.granted) return;
  const profile = await scope.profile.get();
  await scope.memories.setName(profile.preferredName);
}
