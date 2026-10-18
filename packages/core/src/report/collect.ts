/**
 * Reading a report's material from one person's scope: the digest of a
 * period, and what the checks need to know of the diary. Everything goes
 * through the user-scoped repositories.
 */
import type { UserScope } from "../repositories";
import { buildCorpus, entryTexts, type CheckedEntry, type ReportLedger } from "./check";
import type { ReportContent } from "./content";
import { buildDigest, historyStart, type Digest } from "./digest";
import type { ReportPeriod } from "./period";

const DAY = 86_400_000;
/** How far back a report may quote the diary: the chart's four weeks. */
export const QUOTE_WINDOW_DAYS = 28;
const MAX_RECORDS = 500;

export async function collectDigest(
  scope: UserScope,
  period: ReportPeriod,
  timeZone: string,
): Promise<Digest> {
  const [entries, checkins] = await Promise.all([
    scope.entries.list({ from: period.start, to: period.end, limit: MAX_RECORDS }),
    scope.checkins.list({ from: historyStart(period, timeZone), to: period.end, limit: MAX_RECORDS }),
  ]);
  return buildDigest({ period, timeZone, entries, checkins });
}

function checked(entry: {
  id: string;
  occurredAt: Date;
  thoughts: string[] | null;
  emotions: { name: string; intensity: number | null }[] | null;
  body: string | null;
  hotThought: string | null;
  evidenceFor: string | null;
  evidenceAgainst: string | null;
  alternative: string | null;
  alternativeBelief: number | null;
  emotionsAfter: { name: string; intensity: number | null }[] | null;
}): CheckedEntry {
  return {
    id: entry.id,
    occurredAt: entry.occurredAt.toISOString(),
    thoughts: entry.thoughts ?? [],
    emotions: entry.emotions ?? [],
    body: entry.body,
    hotThought: entry.hotThought,
    evidenceFor: entry.evidenceFor,
    evidenceAgainst: entry.evidenceAgainst,
    alternative: entry.alternative,
    alternativeBelief: entry.alternativeBelief,
    emotionsAfter: entry.emotionsAfter ?? [],
  };
}

/**
 * What a report may quote: the person's entries and check-in notes of the
 * four weeks up to the end of the period, and their therapy notes; plus the
 * current state of every entry and check-in the report copied.
 */
export async function reportLedger(
  scope: UserScope,
  period: { start: Date; end: Date },
  content: ReportContent | null,
): Promise<ReportLedger> {
  const from = new Date(Math.min(period.start.getTime(), period.end.getTime() - QUOTE_WINDOW_DAYS * DAY));
  const [entries, checkins, notes] = await Promise.all([
    scope.entries.list({ from, to: period.end, limit: MAX_RECORDS }),
    scope.checkins.list({ from, to: period.end, limit: MAX_RECORDS }),
    scope.therapyNotes.list(),
  ]);
  const byId = new Map(entries.map((entry) => [entry.id, checked(entry)]));
  const noteById = new Map<string, string | null>(checkins.map((c) => [c.id, c.note]));
  // Copied records outside the window (an entry whose time was corrected) are looked up one by one.
  for (const moment of content?.moments ?? []) {
    if (byId.has(moment.entryId)) continue;
    const entry = await scope.entries.get(moment.entryId);
    if (entry) byId.set(entry.id, checked(entry));
  }
  for (const note of content?.notes ?? []) {
    if (noteById.has(note.checkinId)) continue;
    const checkin = await scope.checkins.get(note.checkinId);
    if (checkin) noteById.set(checkin.id, checkin.note);
  }
  const corpus = buildCorpus([
    ...entries.flatMap((entry) => entryTexts(entry)),
    ...checkins.flatMap((c) => [c.note, c.sleepQuality]),
    ...notes.map((note) => note.body),
  ]);
  return { corpus, entries: byId, notes: noteById };
}
