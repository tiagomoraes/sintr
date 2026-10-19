"use server";

import { agreedRecipients, embed, recipientRecord } from "@sintr/agent";
import { MEMORY_CONSENT_VERSION, MemoryText, ValidationError } from "@sintr/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getMessages } from "@/lib/server/language";
import { keepNameInMemory, memoryContext, memoryStateFor, readNow } from "@/lib/server/memory";
import { requireScope } from "@/lib/server/runtime";

/**
 * The person's yes to a memory (DECISIONS 115). The page sends back the
 * providers it named; if they changed since it opened, nothing is recorded
 * and the page says so. The consent records them, the name joins the
 * memory, and the newest pages are read while the person waits. A yes for
 * new providers drops the old vectors, which mean nothing to the new ones.
 */
export async function turnOnMemory(form: FormData): Promise<void> {
  const { scope } = await requireScope();
  const state = await memoryStateFor(scope);
  if (state.kind !== "off" && state.kind !== "paused") redirect("/memory");
  const shown = form.get("recipients");
  if (typeof shown !== "string" || shown !== recipientRecord(state.recipients)) redirect("/memory?changed=1");
  const before = state.kind === "paused" ? state.agreed : null;
  const consent = await scope.consents.record({
    purpose: "memory",
    version: MEMORY_CONSENT_VERSION,
    granted: true,
    recipient: recipientRecord(state.recipients),
  });
  await scope.auditLog.record({
    action: "consent.recorded",
    targetType: "consent",
    targetId: consent.id,
    metadata: { purpose: "memory", version: MEMORY_CONSENT_VERSION, granted: true },
  });
  if (before && recipientRecord(before) !== recipientRecord(state.recipients))
    await scope.memories.unplace(null);
  await keepNameInMemory(scope);
  const read = await readNow(scope);
  revalidatePath("/memory");
  redirect(afterReading(read.problem));
}

/** Where the page goes after a reading: what it says if the reading stopped short. */
function afterReading(problem: string | null): string {
  if (problem === "daily_bound") return "/memory?read=daily";
  return problem ? "/memory?read=failed" : "/memory";
}

/** "Read them now": the next pages, while the person waits. */
export async function readMemoryNow(): Promise<void> {
  const { scope } = await requireScope();
  const read = await readNow(scope);
  revalidatePath("/memory");
  redirect(afterReading(read.problem));
}

export interface CorrectState {
  problem: string | null;
  done: boolean;
}

/**
 * The person's correction: their words replace the memory's sentence and
 * are placed again by meaning, through the providers they agreed to (left
 * unplaced, and placed later, if that fails). Audited without the words.
 */
export async function correctMemory(id: string, _state: CorrectState, form: FormData): Promise<CorrectState> {
  const { scope } = await requireScope();
  const t = (await getMessages()).memory.correct;
  const raw = form.get("text");
  const parsed = MemoryText.safeParse(typeof raw === "string" ? raw : "");
  if (!parsed.success) {
    const empty = typeof raw !== "string" || raw.trim() === "";
    return { problem: empty ? t.empty : t.tooLong, done: false };
  }
  const state = await memoryStateFor(scope);
  const context = memoryContext(scope);
  const placed = state.kind === "on" ? await embed(context, state.route, [parsed.data], 15_000) : null;
  try {
    const memory = await scope.memories.correct(
      id,
      parsed.data,
      placed?.ok ? { space: placed.space, embedding: placed.vectors[0]! } : null,
    );
    if (!memory) return { problem: null, done: true };
    await scope.auditLog.record({ action: "memory.corrected", targetType: "memory", targetId: memory.id });
  } catch (error) {
    if (error instanceof ValidationError) return { problem: t.tooLong, done: false };
    throw error;
  }
  revalidatePath("/memory");
  return { problem: null, done: true };
}

/** Forget one memory: the row is deleted. Audited without its words. */
export async function forgetMemory(id: string): Promise<void> {
  const { scope } = await requireScope();
  if (await scope.memories.forget(id)) {
    await scope.auditLog.record({ action: "data.deleted", targetType: "memory", targetId: id });
  }
  revalidatePath("/memory");
}

/**
 * Forget everything: the consent is withdrawn (a new row, never an edit),
 * then every memory and every record of a reading is deleted. Without the
 * consent the memory does not exist.
 */
export async function forgetEverything(): Promise<void> {
  const { scope } = await requireScope();
  const latest = await scope.consents.latest("memory");
  if (latest?.granted) {
    const consent = await scope.consents.record({
      purpose: "memory",
      version: latest.version,
      granted: false,
      recipient: recipientRecord(agreedRecipients(latest)),
    });
    await scope.auditLog.record({
      action: "consent.recorded",
      targetType: "consent",
      targetId: consent.id,
      metadata: { purpose: "memory", version: latest.version, granted: false },
    });
  }
  const { memories } = await scope.memories.forgetAll();
  await scope.auditLog.record({
    action: "data.deleted",
    targetType: "memories",
    metadata: { count: memories },
  });
  revalidatePath("/memory");
  redirect("/memory?forgot=all");
}
