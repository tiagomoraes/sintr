/**
 * Reading a few pages of the diary for the memory (DECISIONS 113). The
 * model proposes what is worth carrying, through one tool; sintr keeps
 * only what holds to the rules in code:
 * - every memory rests on the person's own words: its quote is found in its
 *   page word for word, and what is kept is the person's span, not the
 *   model's copy (the same finder as drafts, decision 22);
 * - its sentence states no cause and uses no clinical label (the report's
 *   rule, decision 33), and its dashes are smoothed;
 * - nothing the crisis screen stops becomes a memory, in the sentence or
 *   in the quote (pages that the screen stops are never sent at all).
 * A refused memory goes back to the model once with the reason; what is
 * still wrong is dropped.
 */
import {
  MEMORIES_PER_SOURCE,
  entryTexts,
  interpretationsIn,
  type Logger,
  type UnreadSource,
} from "@sintr/core";
import { APICallError, RetryError, generateText, isStepCount, tool, type LanguageModel } from "ai";
import { z } from "zod";
import { screenForRisk } from "../crisis";
import { smoothDashText } from "../dashes";
import { describeProviderError } from "../providers";
import { findVerbatim } from "../words";
import { memoryInput, memoryReadingPrompt } from "./prompt";

/** A first reading, and one chance to fix what was refused. */
export const READING_ATTEMPTS = 2;

/** A page as the model reads it: a short reference, its day, its labelled words. */
export interface Page {
  ref: string;
  source: UnreadSource;
  day: string;
  /** The person's words in it, for the quote check. */
  texts: string[];
}

export const RememberInput = z.object({
  memories: z
    .array(
      z.object({
        page: z.string().max(10).describe("The page it comes from, such as p1."),
        kind: z.enum(["about", "moment"]),
        text: z.string().min(1).max(300).describe("One short sentence, in the language of the page."),
        quote: z.string().min(1).max(400).describe("The person's own words it rests on, copied exactly."),
      }),
    )
    .max(40),
});
export type RememberInput = z.infer<typeof RememberInput>;

export interface ReadMemory {
  kind: "about" | "moment";
  text: string;
  /** The person's span, as they wrote it. */
  quote: string;
}

export type Reading =
  { ok: true; found: Map<string, ReadMemory[]>; refused: number } | { ok: false; problem: string };

/** The person's words of a page, labelled as the model reads them. */
function lines(source: UnreadSource): { label: string; text: string }[] {
  if (source.kind === "checkin") {
    const c = source.checkin;
    return [
      ...(c.note ? [{ label: "note", text: c.note }] : []),
      ...(c.sleepQuality ? [{ label: "sleep", text: c.sleepQuality }] : []),
    ];
  }
  const e = source.entry;
  const emotions = (list: typeof e.emotions) =>
    (list ?? []).map((m) => (m.intensity === null ? m.name : `${m.name} ${m.intensity}`)).join(", ");
  return [
    ["title", e.title],
    ["what happened", e.situation],
    ["thoughts", (e.thoughts ?? []).map((t) => `"${t}"`).join("; ") || null],
    ["feelings", emotions(e.emotions) || null],
    ["body", e.body],
    ["what they did", e.behavior],
    ["context", e.context],
    ["notes", e.notes],
    ["strongest thought", e.hotThought],
    ["evidence for", e.evidenceFor],
    ["evidence against", e.evidenceAgainst],
    ["alternative thought", e.alternative],
    ["feelings after", emotions(e.emotionsAfter) || null],
  ]
    .filter((pair): pair is [string, string] => typeof pair[1] === "string" && pair[1].length > 0)
    .map(([label, text]) => ({ label, text }));
}

/** The words of a page the quote check may find a quote in. */
function pageTexts(source: UnreadSource): string[] {
  if (source.kind === "checkin") {
    return [source.checkin.note, source.checkin.sleepQuality].filter((t): t is string => !!t);
  }
  return entryTexts(source.entry);
}

function dayIn(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(date);
}

/** Pages for the model, in order, with the words each holds. */
export function pagesOf(sources: readonly UnreadSource[], timeZone: string): Page[] {
  return sources.map((source, index) => ({
    ref: `p${index + 1}`,
    source,
    day: dayIn(source.kind === "entry" ? source.entry.occurredAt : source.checkin.occurredAt, timeZone),
    texts: pageTexts(source),
  }));
}

/** A page as the model reads it. */
export function pageText(page: Page): string {
  const kind = page.source.kind === "entry" ? "entry" : "check-in";
  const body = lines(page.source)
    .map((line) => `${line.label}: ${line.text}`)
    .join("\n");
  return `<page id="${page.ref}" kind="${kind}" day="${page.day}">\n${body}\n</page>`;
}

/** Whether a page may be read at all: the crisis screen runs on its words first. */
export function mayRead(page: Page): boolean {
  return !page.texts.some((text) => screenForRisk(text).risk);
}

const QUOTE_MARKS = /^[\s"'“”‘’«»„]+|[\s"'“”‘’«»„]+$/gu;

/** Why a memory was refused, as a code the logs may carry. */
type Refusal = "page" | "empty" | "quote" | "label" | "cause" | "risk";

/** One proposed memory, checked: the person's span and the smoothed sentence, or why not. */
function check(
  memory: RememberInput["memories"][number],
  pages: ReadonlyMap<string, Page>,
): { ok: true; page: string; memory: ReadMemory } | { ok: false; code: Refusal; reason: string } {
  const page = pages.get(memory.page);
  if (!page) return { ok: false, code: "page", reason: `"${memory.page}" is not one of the pages given.` };
  const text = smoothDashText(memory.text).replace(/\s+/gu, " ").trim();
  if (!text) return { ok: false, code: "empty", reason: `${memory.page}: the sentence is empty.` };
  // Models often wrap a quote in quotation marks of their own; the person's words are inside them.
  const quote = findVerbatim(page.texts, memory.quote.replace(QUOTE_MARKS, ""));
  if (!quote) {
    return {
      ok: false,
      code: "quote",
      reason: `${memory.page}: "${memory.quote}" is not words the person wrote on one line of the page. Copy a span of one line they wrote, exactly (a feelings line does not count).`,
    };
  }
  const { causes, labels } = interpretationsIn(text);
  if (labels.length > 0) {
    return {
      ok: false,
      code: "label",
      reason: `${memory.page}: "${labels[0]}" is a clinical label. Describe, in their words.`,
    };
  }
  if (causes.length > 0) {
    return {
      ok: false,
      code: "cause",
      reason: `${memory.page}: "${causes[0]}" states a cause. Say what happened instead.`,
    };
  }
  if (screenForRisk(text).risk || screenForRisk(quote).risk) {
    return { ok: false, code: "risk", reason: `${memory.page}: this is not something to keep in the memory.` };
  }
  return {
    ok: true,
    page: page.ref,
    memory: { kind: memory.kind, text: text.slice(0, 300), quote: quote.slice(0, 400) },
  };
}

/**
 * Read `pages` with the person's model. `known` is what the memory already
 * holds of who they are, so it is not repeated. At most
 * MEMORIES_PER_SOURCE memories are kept from a page.
 */
export async function readPages(input: {
  model: LanguageModel;
  pages: readonly Page[];
  known: readonly string[];
  log: Logger;
  abortSignal?: AbortSignal;
}): Promise<Reading> {
  const { log } = input;
  const byRef = new Map(input.pages.map((page) => [page.ref, page]));
  const found = new Map<string, ReadMemory[]>(input.pages.map((page) => [page.ref, []]));
  const seen = new Set<string>();
  let refused = 0;
  let attempts = 0;
  let done = false;

  const tools = {
    remember: tool({
      description:
        "Keep what is worth remembering from these pages: each memory one short sentence, with the person's own words it rests on. An empty list keeps nothing.",
      inputSchema: RememberInput,
      execute: async ({ memories }) => {
        attempts += 1;
        const reasons: string[] = [];
        for (const memory of memories) {
          const result = check(memory, byRef);
          if (!result.ok) {
            reasons.push(result.reason);
            // The code only: the reason quotes the person's words.
            log.info("memory.refused", { code: result.code, attempt: attempts });
            continue;
          }
          const list = found.get(result.page)!;
          const key = `${result.memory.kind}:${result.memory.text.toLocaleLowerCase()}`;
          if (seen.has(key) || list.length >= MEMORIES_PER_SOURCE) continue;
          seen.add(key);
          list.push(result.memory);
        }
        refused = reasons.length;
        if (reasons.length === 0) {
          done = true;
          return { ok: true as const };
        }
        return {
          ok: false as const,
          refused: reasons,
          note: "Send only the corrected ones; the others are kept.",
        };
      },
    }),
  };

  try {
    await generateText({
      model: input.model,
      instructions: memoryReadingPrompt(),
      prompt: memoryInput({ pages: input.pages.map(pageText), known: input.known }),
      tools,
      toolChoice: "required",
      stopWhen: [isStepCount(READING_ATTEMPTS), () => done],
      maxRetries: 1,
      timeout: { totalMs: 120_000 },
      ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
      telemetry: { isEnabled: false },
    });
  } catch (error) {
    if (attempts === 0) {
      const fromProvider =
        APICallError.isInstance(error) ||
        RetryError.isInstance(error) ||
        error instanceof TypeError ||
        (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError"));
      const problem = fromProvider ? describeProviderError(error) : "no_reading";
      log.warn("memory.read_failed", { code: problem, error });
      return { ok: false, problem };
    }
  }
  if (attempts === 0) {
    log.warn("memory.read_failed", { code: "no_reading" });
    return { ok: false, problem: "no_reading" };
  }
  const kept = [...found.values()].reduce((sum, list) => sum + list.length, 0);
  // Only fields the logger lets through: how many were kept, after how many attempts.
  log.info("memory.read", { count: kept, attempt: attempts, code: refused > 0 ? "some_refused" : "ok" });
  return { ok: true, found, refused };
}
