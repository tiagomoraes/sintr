/**
 * The parts of a report sintr can prepare on its own, with no model: the
 * moments copied word for word from their entries, the check-in notes, and
 * the person's own topics for the session. The prose is left for the
 * person (or the assistant) to write; nothing is made up to fill it.
 */
import type { ReportContent, ReportLanguage, ReportMoment } from "./content";
import type { Digest, DigestEntry } from "./digest";

const MOMENTS = 4;

/** A moment as a copy of its entry. The assistant may only replace the prose fields. */
export function momentFromEntry(
  entry: DigestEntry,
  prose: { title?: string | null; happened?: string | null; did?: string | null } = {},
): ReportMoment {
  const firstWords = (text: string | null) => {
    if (!text) return null;
    const flat = text.replace(/\s+/gu, " ").trim();
    if (flat.length <= 80) return flat;
    const cut = flat.slice(0, 80);
    const space = cut.lastIndexOf(" ");
    return `${space > 40 ? cut.slice(0, space) : cut}...`;
  };
  return {
    entryId: entry.id,
    occurredAt: entry.occurredAt,
    title: prose.title?.trim() || entry.title || firstWords(entry.situation) || firstWords(entry.notes) || "",
    happened: prose.happened?.trim() || entry.situation || entry.notes,
    context: entry.context,
    thoughts: [...entry.thoughts],
    hotThought: entry.hotThought,
    felt: entry.emotions.map((e) => ({ ...e })),
    body: entry.body,
    did: prose.did?.trim() || entry.behavior,
    evidenceFor: entry.evidenceFor,
    evidenceAgainst: entry.evidenceAgainst,
    alternative: entry.alternative,
    belief: entry.alternativeBelief,
    feltAfter: entry.emotionsAfter.map((e) => ({ ...e })),
    tags: [...entry.tags],
  };
}

/** The strongest moments first (the peak intensity the person gave), then the latest. */
export function strongestEntries(entries: readonly DigestEntry[], limit = MOMENTS): DigestEntry[] {
  return [...entries]
    .sort(
      (a, b) => (b.peakIntensity ?? -1) - (a.peakIntensity ?? -1) || b.occurredAt.localeCompare(a.occurredAt),
    )
    .slice(0, limit)
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
}

export function draftContent(input: {
  digest: Digest;
  language: ReportLanguage;
  /** The person's own "things to bring up", word for word. */
  toBring: readonly string[];
  problem?: string | null;
}): ReportContent {
  const { digest } = input;
  return {
    v: 1,
    language: input.language,
    week: "",
    topics: input.toBring.slice(0, 6).map((text) => ({ text, suggested: false })),
    mood: "",
    notes: digest.notes.map((note) => ({ checkinId: note.checkinId, day: note.day, note: note.note })),
    momentsIntro: "",
    moments: strongestEntries(digest.entries).map((entry) => momentFromEntry(entry)),
    patterns: [],
    helped: [],
    author: "sintr",
    problem: input.problem ?? null,
    numbers: null,
  };
}
