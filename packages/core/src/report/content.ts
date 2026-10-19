/**
 * What a report says, as stored (sealed) in `reports.content`: the six
 * sections of the agent pack's weekly report guide, as structured JSON
 * rather than Markdown, so the person can read and edit it as a page and
 * no renderer has to guess what a model meant.
 *
 * - The prose (how the week went, the reading of the numbers, the topics,
 *   what repeated, what helped) is written by the assistant, or by the
 *   person; it is checked, never trusted.
 * - A moment is a copy of one entry, taken word for word when the report is
 *   prepared: the assistant chooses which entries and may condense what
 *   happened and what they did, but the thoughts, emotions, intensities and
 *   the working of a thought come from the entry, never from the model.
 * - The numbers are computed. They are frozen into `numbers` when the
 *   person approves the report, so a sent report keeps what was sent; so
 *   are the quotes found word for word (`verified`), which decide the
 *   highlighter, so a shared copy reads exactly as it was approved.
 */
import { z } from "zod";
import { Emotion } from "../domain";
import type { DigestNumbers } from "./digest";

export const REPORT_LANGUAGES = ["en", "pt", "es"] as const;
export type ReportLanguage = (typeof REPORT_LANGUAGES)[number];

/** The report language of a BCP 47 tag: Portuguese, Spanish, or English. */
export function reportLanguage(tag: string | null | undefined): ReportLanguage {
  const base = (tag ?? "").toLowerCase().split(/[-_]/u)[0];
  return base === "pt" || base === "es" ? base : "en";
}

const Prose = z.string().max(6_000);
const Line = z.string().max(1_500);
const Words = z.string().min(1).max(20_000);

export const ReportMoment = z.object({
  entryId: z.string().min(1).max(100),
  /** ISO 8601, from the entry. */
  occurredAt: z.string().max(40),
  title: z.string().max(200),
  happened: Words.nullable(),
  context: Words.nullable(),
  thoughts: z.array(Words).max(50),
  /** Marked only when the person marked it. */
  hotThought: Words.nullable(),
  felt: z.array(Emotion).max(30),
  body: Words.nullable(),
  did: Words.nullable(),
  evidenceFor: Words.nullable(),
  evidenceAgainst: Words.nullable(),
  alternative: Words.nullable(),
  belief: z.number().int().min(0).max(100).nullable(),
  feltAfter: z.array(Emotion).max(30),
  tags: z.array(z.string().min(1).max(100)).max(30),
});
export type ReportMoment = z.infer<typeof ReportMoment>;

/** The fields of a moment the person may rewrite; the rest is the entry's. */
export const MOMENT_PROSE = ["title", "happened", "context", "did"] as const;

export const ReportTopic = z.object({ text: Line, suggested: z.boolean() });
export type ReportTopic = z.infer<typeof ReportTopic>;

export const ReportPattern = z.object({ when: z.string().max(80), text: Line });
export type ReportPattern = z.infer<typeof ReportPattern>;

export const ReportNote = z.object({ checkinId: z.string().max(100), day: z.string().max(10), note: Words });
export type ReportNote = z.infer<typeof ReportNote>;

/** Kept loose on purpose: computed by sintr, read back only to print. */
const Numbers = z.custom<DigestNumbers>((value) => typeof value === "object" && value !== null);

export const ReportContent = z.object({
  v: z.literal(1),
  language: z.enum(REPORT_LANGUAGES),
  week: Prose,
  topics: z.array(ReportTopic).max(12),
  mood: Prose,
  notes: z.array(ReportNote).max(60),
  momentsIntro: Line,
  moments: z.array(ReportMoment).max(8),
  patterns: z.array(ReportPattern).max(12),
  helped: z.array(Line).max(12),
  /** Who wrote the prose: the person's assistant, or sintr alone (no assistant, or it failed). */
  author: z.enum(["assistant", "sintr"]),
  /** Why the assistant did not write it, as a code. */
  problem: z.string().max(60).nullable(),
  numbers: Numbers.nullable(),
  /** The quotes found in the diary word for word when the person approved it (normalised). */
  verified: z.array(z.string().max(6_000)).max(1_000).nullable().optional(),
});
export type ReportContent = z.infer<typeof ReportContent>;

/** The six sections, in the template's order (the person's agenda second, on page 1). */
export const REPORT_SECTIONS = ["week", "session", "mood", "moments", "patterns", "helped"] as const;
export type ReportSection = (typeof REPORT_SECTIONS)[number];

export function serializeContent(content: ReportContent): string {
  return JSON.stringify(content);
}

/** The stored content, or null when it cannot be read as a report. */
export function parseContent(stored: string | null): ReportContent | null {
  if (!stored) return null;
  try {
    const parsed = ReportContent.safeParse(JSON.parse(stored));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Which sections differ between two versions, for a revision record. */
export function changedSections(before: ReportContent, after: ReportContent): ReportSection[] {
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const out: ReportSection[] = [];
  if (!same(before.week, after.week)) out.push("week");
  if (!same(before.topics, after.topics)) out.push("session");
  if (!same(before.mood, after.mood) || !same(before.notes, after.notes)) out.push("mood");
  if (!same(before.momentsIntro, after.momentsIntro) || !same(before.moments, after.moments))
    out.push("moments");
  if (!same(before.patterns, after.patterns)) out.push("patterns");
  if (!same(before.helped, after.helped)) out.push("helped");
  return out;
}
