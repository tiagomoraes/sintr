/**
 * The shapes the conversation shares with the browser: what the assistant
 * may draft, and the parts a conversation message can carry. Types and Zod
 * schemas only, so the web app can import them into client components.
 */
import type { CheckinInput, EntryInput, ProposalKind, ProposalStatus } from "@sintr/core";
import type { UIMessage, UIMessageChunk } from "ai";
import { z } from "zod";

const Words = z.string().max(20_000);
const Score100 = z.number().int().min(0).max(100);
const Score5 = z.number().int().min(0).max(5);

const EmotionDraft = z.object({
  name: z
    .string()
    .min(1)
    .max(200)
    .describe("The person's own word for the emotion, exactly as they wrote it."),
  intensity: Score100.optional().describe(
    "0 to 100, only if the person gave this number. Otherwise leave it out.",
  ),
});

/**
 * A thought record the assistant drafts from the conversation (Tier 1, plus
 * Tier 2 only when the person worked on it). Every field is optional:
 * capture first, a partial entry is a real entry.
 */
export const EntryDraft = z.object({
  title: z.string().max(200).optional().describe("A short, neutral title in the person's language."),
  situation: Words.optional().describe(
    "What happened: when, where, who, what. The person's account, condensed but faithful, in their language.",
  ),
  thoughts: z
    .array(Words)
    .max(8)
    .optional()
    .describe("The automatic thoughts, each copied word for word from the person's messages."),
  emotions: z.array(EmotionDraft).max(6).optional().describe("One to four emotions, in the person's words."),
  body: Words.optional().describe("Physical sensations, only if the person mentioned them."),
  behavior: Words.optional().describe("What the person did next, as they said it. 'Nothing' is valid."),
  context: Words.optional().describe("Backdrop the person offered: sleep, food, workload, health."),
  tags: z
    .array(z.string().min(1).max(60))
    .max(8)
    .optional()
    .describe("Life areas touched, such as work, family, health, relationship, self."),
  notes: Words.optional().describe(
    "Anything else the person wants kept, or the whole entry on a venting day.",
  ),
  occurredAt: z
    .string()
    .max(40)
    .optional()
    .describe("ISO 8601 date and time, only if the person said when it happened."),
  hotThought: Words.optional().describe("Tier 2: the strongest thought, word for word."),
  evidenceFor: Words.optional().describe(
    "Tier 2: facts the person cites for the hot thought, in their words.",
  ),
  evidenceAgainst: Words.optional().describe("Tier 2: facts the person cites against it, in their words."),
  alternative: Words.optional().describe("Tier 2: the balanced thought the person found, word for word."),
  alternativeBelief: Score100.optional().describe("Tier 2: 0 to 100, how believable the alternative feels."),
  emotionsAfter: z
    .array(EmotionDraft)
    .max(6)
    .optional()
    .describe("Tier 2: the same emotions, re-rated by the person."),
});
export type EntryDraft = z.infer<typeof EntryDraft>;

/** A quick check-in: only what the person gave. Scales are 0 to 5. */
export const CheckinDraft = z.object({
  mood: Score5.optional().describe("0 to 5, only if given."),
  energy: Score5.optional().describe("0 to 5, only if given."),
  anxiety: Score5.optional().describe("0 to 5, only if given."),
  sleepHours: z.number().min(0).max(24).optional().describe("Hours slept, only if given."),
  sleepQuality: z.string().max(500).optional().describe("How the sleep was, in the person's words."),
  note: Words.optional().describe("Anything else the person said about the day."),
  occurredAt: z.string().max(40).optional().describe("ISO 8601, only if the person said when."),
});
export type CheckinDraft = z.infer<typeof CheckinDraft>;

/** What a propose tool answers: a stored draft, or what to fix first. */
export type ProposeResult<D> = { ok: true; proposalId: string; draft: D } | { ok: false; problems: string[] };

/** The person's decision on a draft, as the conversation shows it. */
export interface ProposalState {
  kind: ProposalKind;
  status: ProposalStatus;
  recordId: string | null;
  edited: boolean;
}

/** A compact view of the last days, for continuity. Minimal on purpose. */
export interface RecentContext {
  days: number;
  entries: { day: string; title: string | null; emotions: { name: string; intensity: number | null }[] }[];
  checkins: {
    day: string;
    mood: number | null;
    energy: number | null;
    anxiety: number | null;
    sleepHours: number | null;
  }[];
}

export type SintrDataParts = {
  /** The diary stopped and human help was shown. */
  crisis: { source: "screen" | "assistant" };
  /** A draft's decision changed during this turn (for example after "salva"). */
  proposal: { proposalId: string; status: ProposalStatus; recordId: string | null };
  /** Sent first on a new conversation, so the page can keep its address. */
  conversation: { conversationId: string };
  /** The house assistant's meter after this message (not stored): for a quiet warning before the limit. */
  usage: { used: number; limit: number; next: string };
  /**
   * This month's messages on the person's plan are used, so the assistant
   * did not run. Nothing is lost: the message is kept, and offered back as
   * a draft entry in the person's own words (`kept`), or the draft they
   * told sintr to save was saved (`saved`).
   */
  limit: {
    used: number;
    limit: number | null;
    /** When the count starts again (YYYY-MM-DD, the first day of the next month). */
    next: string;
    kept: { proposalId: string; draft: EntryDraft } | null;
    saved: ProposalKind | null;
  };
};

export type SintrTools = {
  propose_entry: { input: EntryDraft; output: ProposeResult<EntryDraft> };
  propose_checkin: { input: CheckinDraft; output: ProposeResult<CheckinDraft> };
  recent_context: { input: Record<string, never>; output: RecentContext };
  signal_crisis: { input: { language?: string }; output: { stopped: true } };
};

export type SintrUIMessage = UIMessage<unknown, SintrDataParts, SintrTools>;
export type SintrUIMessageChunk = UIMessageChunk<unknown, SintrDataParts>;

function given<T>(value: T | undefined | null): value is T {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/** A draft as a record input: absent stays absent, never filled in. */
export function entryInputFromDraft(draft: EntryDraft): EntryInput {
  const emotions = (list: EntryDraft["emotions"]) =>
    list?.map((emotion) => ({ name: emotion.name, intensity: emotion.intensity ?? null }));
  const out: Record<string, unknown> = {};
  for (const key of [
    "title",
    "situation",
    "body",
    "behavior",
    "context",
    "notes",
    "hotThought",
    "evidenceFor",
    "evidenceAgainst",
    "alternative",
  ] as const) {
    if (given(draft[key])) out[key] = draft[key];
  }
  if (given(draft.thoughts)) out.thoughts = draft.thoughts.filter((t) => given(t));
  if (given(draft.tags)) out.tags = draft.tags;
  if (given(draft.emotions)) out.emotions = emotions(draft.emotions);
  if (given(draft.emotionsAfter)) out.emotionsAfter = emotions(draft.emotionsAfter);
  if (given(draft.alternativeBelief)) out.alternativeBelief = draft.alternativeBelief;
  if (given(draft.occurredAt) && !Number.isNaN(Date.parse(draft.occurredAt)))
    out.occurredAt = draft.occurredAt;
  return out;
}

export function checkinInputFromDraft(draft: CheckinDraft): CheckinInput {
  const out: Record<string, unknown> = {};
  for (const key of ["mood", "energy", "anxiety", "sleepQuality", "note"] as const) {
    if (given(draft[key])) out[key] = draft[key];
  }
  // Sleep is stored to a tenth of an hour (numeric(3,1)).
  if (given(draft.sleepHours)) out.sleepHours = Math.round(draft.sleepHours * 10) / 10;
  if (given(draft.occurredAt) && !Number.isNaN(Date.parse(draft.occurredAt)))
    out.occurredAt = draft.occurredAt;
  return out;
}

/** Why speaking is not on offer (see voice.ts): no assistant yet, turned off, a provider without audio, or one sintr does not know. */
export type VoiceUnavailable = "not_configured" | "off" | "provider_has_no_audio" | "provider_unknown";

/** Why there is no memory to offer: no assistant, the house turned it off, or a provider sintr cannot ask for vectors. */
export type MemoryUnavailable = "not_configured" | "off" | "provider_has_no_embeddings" | "provider_unknown";

/** The crisis lines named in the brief and the pack, in the order to call. */
export const CRISIS_LINES = [
  { name: "CVV", number: "188", where: "Brazil", note: "free, 24 hours" },
  { name: "SAMU", number: "192", where: "Brazil", note: "medical emergencies" },
] as const;
