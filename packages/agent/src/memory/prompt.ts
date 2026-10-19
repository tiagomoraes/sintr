/**
 * The memory's words for the model: the instructions for reading the diary,
 * and what the capture conversation is told (DECISIONS 113 and 116). The
 * capture instructions themselves do not change; this is a section after
 * them, the only place the memory has to be told about.
 */
import { MEMORIES_PER_SOURCE, type Memory } from "@sintr/core";

/** How to read a few pages of the diary for the memory. */
export function memoryReadingPrompt(): string {
  return `You read a few pages of a person's private diary for sintr, the diary they keep between therapy sessions, and note what their own assistant should remember about them, so it is not blind the next time they talk. You are not a therapist and you do not interpret.

Two kinds of memory:
- about: who they are. The people in their life, by the names they use for them; their work or studies; where they live; routines; what matters to them; how they want to be called, if they say so.
- moment: something that happened, as a short fact: what happened and, if they wrote it, how strongly they felt it.

How to write each one
- One short plain sentence, at most 200 characters, in the language the page is written in. Third person without their name, as a note: "Works night shifts at the hospital." or "Trabalha em plantões noturnos no hospital."
- Never assume their gender: no "he", "she", "ele", "ela"; a note without a subject reads fine.
- One event is a moment, never a habit or a trait: "Has a manager, Marcos." ("Tem um chefe, Marcos."), not "Has a manager who always questions deadlines." ("Tem um chefe que cobra prazos.")
- Every memory rests on the person's own words: in quote, copy the exact span of the page it comes from, word for word, without changing a letter.
- Nothing they did not write: no interpretation, no cause, no diagnosis or clinical label, no advice, no judgement, no feelings they did not name, no guess about what it means.
- Never paraphrase a thought into something else; if a thought matters, the quote carries it.
- Do not repeat what is already known (listed below), and do not keep the same thing twice.
- At most ${MEMORIES_PER_SOURCE} memories from one page; a page with nothing worth carrying gives none. Small talk about the weather or a meal is not worth carrying unless it matters to them.
- Never keep anything about wanting to die, suicide or self-harm, even in passing, and nothing about harming someone: that is not for a memory. sintr's crisis protocol answers it when it is said.
- Plain text: no markdown, no emoji, no em dashes.

Call the remember tool once with every memory, each naming its page. If some come back refused, send only those again, corrected.`;
}

/** The pages to read, and what is already known. */
export function memoryInput(input: { pages: readonly string[]; known: readonly string[] }): string {
  const known = input.known.length
    ? `Already known about them:\n${input.known.map((text) => `- ${text}`).join("\n")}`
    : "Nothing is known about them yet.";
  return `${known}\n\nThe pages:\n\n${input.pages.join("\n\n")}`;
}

/** What the conversation is told: the memories in front of it, or that there is no memory. */
export type MemoryNote =
  | {
      state: "on";
      name: string | null;
      about: readonly Memory[];
      lately: readonly Memory[];
      related: readonly Memory[];
    }
  | { state: "off" | "paused" };

function day(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function line(memory: Memory, timeZone: string): string {
  const quote = memory.quote ? ` Their words: "${memory.quote}"` : "";
  return `- ${day(memory.occurredAt, timeZone)}: ${memory.text}${quote}`;
}

/** The section after the capture instructions. */
export function memorySection(note: MemoryNote, timeZone: string): string {
  if (note.state !== "on") {
    const why =
      note.state === "paused"
        ? "sintr's memory of this person is paused (their assistant changed, and they have not agreed for the new one yet)"
        : "sintr keeps no memory of this person: their memory is off";
    return `Memory
${why}. You know only this conversation and what recent_context returns. If they expect you to remember something from before, say plainly that you do not have it, and that they can see why, and turn the memory on, in Memory.`;
  }
  const parts: string[] = [];
  if (note.name) parts.push(`They go by: ${note.name}`);
  if (note.about.length) parts.push(`Who they are:\n${note.about.map((m) => line(m, timeZone)).join("\n")}`);
  if (note.lately.length) parts.push(`Lately:\n${note.lately.map((m) => line(m, timeZone)).join("\n")}`);
  if (note.related.length) {
    parts.push(
      `Related to what they are telling you now:\n${note.related.map((m) => line(m, timeZone)).join("\n")}`,
    );
  }
  const memories = parts.length
    ? parts.join("\n\n")
    : "Nothing yet: sintr has not kept anything from their diary so far.";
  return `What you remember about them
sintr keeps a memory of this person, drawn from their own diary, which they can read, correct and forget in Memory. Use it the way someone who has been listening for months would: call them by the name they go by, remember what was going on, and say that they mentioned something before only when a memory below shows it. A memory is context, not a script: never a diagnosis or a conclusion about them, never a reason to steer the conversation, and never something they said today. Bring one up only when it helps what they are telling you now, and never recite the list. If they say a memory is wrong, believe them, and tell them they can correct or forget it in Memory. The safety rules above always come first.

<memory>
${memories}
</memory>`;
}
