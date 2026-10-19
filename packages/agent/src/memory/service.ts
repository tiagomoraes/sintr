/**
 * The memory's life, for one person (DECISIONS 113 to 117):
 * - whether it is on: their latest memory consent is granted, in its
 *   current wording, and names the providers that would read now;
 * - reading the diary into it, a few pages at a time (the worker, and
 *   "Read it now" in Memory), within the house's daily bound;
 * - what a conversation is told: the name, who they are, lately, and what
 *   is near in meaning to what they just said.
 * Without the consent nothing here sends anything anywhere, and nothing is
 * kept.
 */
import {
  MEMORY_CONSENT_VERSION,
  type Consent,
  type FoundMemory,
  type Logger,
  type ReadSource,
  type UnreadSource,
  type UserScope,
} from "@sintr/core";
import { resolveAssistant, type AssistantConfig } from "../assistant";
import {
  REHEARSAL_MODEL,
  embedTexts,
  rehearsalEmbedding,
  type Embedding,
  type EmbeddingProblem,
} from "./embed";
import type { MemoryNote } from "./prompt";
import { mayRead, pagesOf, readPages, type Page } from "./read";
import {
  memoryRecipients,
  memoryRouteFor,
  providerName,
  type EmbeddingRoute,
  type MemorySource,
  type MemoryUnavailable,
} from "./route";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Pages read in one call to the model. */
export const PAGES_PER_READING = 8;
/** Pages the house reads for one person in a day (DECISIONS 119): enough for any diary, a bound on the house's key. */
export const HOUSE_DAILY_PAGES = 100;
/** What is always in front of the assistant, and what is found by meaning. */
export const RECALL = {
  about: 8,
  lately: 3,
  latelyDays: 14,
  related: 6,
  /**
   * Cosine distance. With OpenAI's small model, measured on diary pages in
   * Portuguese, related memories sat at 0.3 to 0.5 and unrelated ones from
   * 0.65 up; 0.6 keeps the first and leaves the second.
   */
  maxDistance: 0.6,
} as const;

export type MemoryState =
  | {
      kind: "on";
      source: MemorySource;
      route: Exclude<EmbeddingRoute, { kind: "none" }>;
      /** Who receives the diary, as the consent named them. */
      recipients: string[];
    }
  /** Not on; it could be, naming these. */
  | { kind: "off"; recipients: string[] }
  /**
   * On, but not usable as agreed: the providers changed (`route`), the
   * wording of the consent changed (`wording`), or the person's provider
   * can no longer place memories. The memories wait; nothing is sent.
   */
  | {
      kind: "paused";
      why: "route" | "wording" | MemoryUnavailable;
      recipients: string[];
      agreed: string[];
    }
  /** Not on, and it cannot be with this assistant. */
  | { kind: "unavailable"; reason: MemoryUnavailable; provider: string | null };

/** The providers a memory consent named, as it recorded them. */
export function agreedRecipients(consent: Pick<Consent, "recipient"> | null): string[] {
  if (!consent?.recipient) return [];
  try {
    const value = JSON.parse(consent.recipient) as unknown;
    return Array.isArray(value) ? value.filter((name): name is string => typeof name === "string") : [];
  } catch {
    return [];
  }
}

/** How the consent records who receives the diary. */
export function recipientRecord(recipients: readonly string[]): string {
  return JSON.stringify(recipients);
}

function sameNames(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((name, index) => name === b[index]);
}

/** Whether this person's memory is on, and through whom. Reads no content. */
export async function memoryState(scope: UserScope, config: AssistantConfig): Promise<MemoryState> {
  const [own, consent] = await Promise.all([
    scope.agentSettings.credentials(),
    scope.consents.latest("memory"),
  ]);
  const routed = memoryRouteFor(own, config.house);
  const recipients = memoryRecipients(own, config.house, routed);
  const on = consent?.granted === true;
  if (!on) {
    if (routed.route.kind === "none") {
      return { kind: "unavailable", reason: routed.route.reason, provider: own ? providerName(own) : null };
    }
    return { kind: "off", recipients };
  }
  const agreed = agreedRecipients(consent);
  if (routed.route.kind === "none") return { kind: "paused", why: routed.route.reason, recipients, agreed };
  if (consent.version !== MEMORY_CONSENT_VERSION)
    return { kind: "paused", why: "wording", recipients, agreed };
  if (!sameNames(agreed, recipients)) return { kind: "paused", why: "route", recipients, agreed };
  return { kind: "on", source: routed.source!, route: routed.route, recipients };
}

export interface MemoryContext {
  scope: UserScope;
  config: AssistantConfig;
  log: Logger;
  /** For tests: a fetch that never reaches the network. */
  fetch?: typeof fetch;
}

/** Vectors for these words through the person's route; the rehearsal embedder with SINTR_FAKE_AGENT. */
export async function embed(
  context: Pick<MemoryContext, "config" | "log" | "fetch">,
  route: Exclude<EmbeddingRoute, { kind: "none" }>,
  texts: readonly string[],
  timeoutMs?: number,
): Promise<Embedding> {
  if (context.config.fakeAgent) return rehearsalEmbedding(texts);
  return embedTexts(route, texts, {
    mode: context.config.mode,
    log: context.log,
    ...(context.fetch ? { fetch: context.fetch } : {}),
    ...(timeoutMs ? { timeoutMs } : {}),
  });
}

function readSource(source: UnreadSource): ReadSource {
  return source.kind === "entry"
    ? { kind: "entry", id: source.entry.id, updatedAt: source.entry.updatedAt }
    : { kind: "checkin", id: source.checkin.id, updatedAt: source.checkin.updatedAt };
}

function occurredAt(source: UnreadSource): Date {
  return source.kind === "entry" ? source.entry.occurredAt : source.checkin.occurredAt;
}

export interface Remembered {
  state: MemoryState["kind"];
  /** Pages read (including pages the crisis screen kept out). */
  read: number;
  /** Memories kept from them. */
  kept: number;
  /** Memories placed by meaning that had no place. */
  placed: number;
  /** Pages still waiting. */
  waiting: number;
  /** Why it stopped short, as a code. */
  problem: string | null;
}

/** Place memories that have no vector yet (new ones the provider could not place, corrections, a new space). */
async function placePending(
  context: MemoryContext,
  route: Exclude<EmbeddingRoute, { kind: "none" }>,
): Promise<{ placed: number; problem: EmbeddingProblem | null }> {
  const pending = await context.scope.memories.unplaced(40);
  if (pending.length === 0) return { placed: 0, problem: null };
  const result = await embed(
    context,
    route,
    pending.map((memory) => memory.text),
  );
  if (!result.ok) return { placed: 0, problem: result.problem };
  await context.scope.memories.place(
    result.space,
    pending.map((memory, index) => ({ id: memory.id, embedding: result.vectors[index]! })),
  );
  return { placed: pending.length, problem: null };
}

/**
 * Read the next pages of the diary into the memory, if it is on: the
 * newest first, at most `pages` (and, on the house, within its daily
 * bound). Pages the crisis screen stops are marked read and never sent.
 * Memories without a place are placed first. Nothing is read twice unless
 * the page changed.
 */
export async function rememberNow(
  context: MemoryContext,
  options: { pages?: number; now?: Date } = {},
): Promise<Remembered> {
  const { scope, log } = context;
  const now = options.now ?? new Date();
  const state = await memoryState(scope, context.config);
  const result: Remembered = { state: state.kind, read: 0, kept: 0, placed: 0, waiting: 0, problem: null };
  if (state.kind !== "on") return result;

  // Vectors of another model (the operator changed it) are dropped first, so they are placed again.
  await scope.memories.unplace(context.config.fakeAgent ? REHEARSAL_MODEL : state.route.model);
  const pending = await placePending(context, state.route);
  result.placed = pending.placed;

  let budget = Math.min(options.pages ?? PAGES_PER_READING, PAGES_PER_READING);
  if (state.source === "house") {
    const today = await scope.memories.readSince(new Date(now.getTime() - DAY_MS));
    budget = Math.min(budget, HOUSE_DAILY_PAGES - today);
    if (budget <= 0) {
      result.problem = "daily_bound";
      result.waiting = (await scope.memories.progress()).unread;
      return result;
    }
  }
  const sources = await scope.memories.unread(budget);
  if (sources.length === 0) return result;

  const profile = await scope.profile.get();
  const pages = pagesOf(sources, profile.timezone);
  const stopped = pages.filter((page) => !mayRead(page));
  const readable = pages.filter(mayRead);
  for (const page of stopped) {
    // Words the crisis screen stops are never sent to a model, and never kept.
    await scope.memories.keep(readSource(page.source), [], {
      occurredAt: occurredAt(page.source),
      space: null,
    });
    result.read += 1;
  }
  if (stopped.length > 0) log.info("memory.page_not_read", { count: stopped.length, code: "crisis_screen" });

  if (readable.length > 0) {
    const assistant = await resolveAssistant(
      scope,
      context.config,
      context.fetch ? { fetch: context.fetch } : {},
    );
    if (!assistant.ok) {
      result.problem = assistant.problem;
      log.warn("memory.read_failed", { code: assistant.problem });
    } else {
      const known = (await scope.memories.list())
        .filter((memory) => memory.kind === "about")
        .slice(0, 40)
        .map((memory) => memory.text);
      const reading = await readPages({ model: assistant.model, pages: readable, known, log });
      if (!reading.ok) {
        // Nothing is marked read: the pages wait for the next reading.
        result.problem = reading.problem;
      } else {
        await keepReading(context, state.route, readable, reading.found, result);
      }
    }
  }
  result.waiting = (await scope.memories.progress()).unread;
  return result;
}

/** Place what a reading found by meaning, in one call, and keep it page by page. */
async function keepReading(
  context: MemoryContext,
  route: Exclude<EmbeddingRoute, { kind: "none" }>,
  pages: readonly Page[],
  found: ReadonlyMap<string, readonly { kind: "about" | "moment"; text: string; quote: string }[]>,
  result: Remembered,
): Promise<void> {
  const all = pages.flatMap((page) => found.get(page.ref) ?? []);
  const embedding =
    all.length > 0
      ? await embed(
          context,
          route,
          all.map((memory) => memory.text),
        )
      : null;
  // A memory the provider could not place is kept without a place, and placed later.
  const vectors = embedding?.ok ? embedding.vectors : null;
  if (embedding && !embedding.ok) result.problem = embedding.problem;
  let index = 0;
  for (const page of pages) {
    const memories: FoundMemory[] = (found.get(page.ref) ?? []).map((memory) => ({
      ...memory,
      embedding: vectors ? vectors[index++]! : null,
    }));
    if (!vectors) index += memories.length;
    const kept = await context.scope.memories.keep(readSource(page.source), memories, {
      occurredAt: occurredAt(page.source),
      space: embedding?.ok ? embedding.space : null,
    });
    result.read += 1;
    result.kept += kept.length;
  }
}

/**
 * What the conversation is told about the person: the name, who they are,
 * what happened lately and what is near in meaning to `text`, when the
 * memory is on; otherwise only that it is off or paused. If placing `text`
 * fails, the conversation goes on with what needs no place.
 */
export async function recall(
  context: MemoryContext,
  input: { text: string; now?: Date },
): Promise<MemoryNote> {
  const { scope } = context;
  const state = await memoryState(scope, context.config);
  if (state.kind !== "on") return { state: state.kind === "paused" ? "paused" : "off" };
  const now = input.now ?? new Date();
  const lately = await scope.memories.lately({
    about: RECALL.about,
    moments: RECALL.lately,
    since: new Date(now.getTime() - RECALL.latelyDays * DAY_MS),
  });
  const note: Extract<MemoryNote, { state: "on" }> = {
    state: "on",
    name: lately.find((memory) => memory.kind === "name")?.text ?? null,
    about: lately.filter((memory) => memory.kind === "about"),
    lately: lately.filter((memory) => memory.kind === "moment"),
    related: [],
  };
  const text = input.text.trim().slice(0, 2_000);
  if (!text) return note;
  const placed = await embed(context, state.route, [text], 8_000);
  if (!placed.ok) return note;
  note.related = await scope.memories.nearest(placed.space, placed.vectors[0]!, {
    limit: RECALL.related,
    maxDistance: RECALL.maxDistance,
    exclude: lately.map((memory) => memory.id),
  });
  return note;
}
