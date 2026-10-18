/**
 * The report's checks, as in the agent pack's `report_pdf.py`: every quoted
 * span must be the person's own words, found in the diary word for word
 * (forgiving case, spacing and quote styles, at word boundaries); every
 * moment must still match its entry; and the prose must not state causes,
 * use clinical labels or leave an observation undated.
 *
 * A quote that is not found keeps its quotation marks but loses the peach
 * highlighter, so the page never claims words that are not the person's.
 * Problems carry the quoted words so the person can find them on screen;
 * they are never logged (log only their codes).
 */
import type { Emotion } from "../domain";
import type { ReportContent, ReportMoment, ReportSection } from "./content";

const QUOTE_PAIRS: [string, string][] = [
  ["“", "”"],
  ['"', '"'],
  ["«", "»"],
  ["„", "“"],
];

const QUOTE_RE = new RegExp(
  QUOTE_PAIRS.map(
    ([open, close]) => `${escape(open)}([^${escape(close)}${escape(open)}\\n]{1,1500})${escape(close)}`,
  ).join("|"),
  "gu",
);

function escape(text: string): string {
  return text.replace(/[\\^$.*+?()[\]{}|]/gu, (c) => `\\${c}`);
}

/** A piece of text, with each quoted span apart. */
export type TextPart = { quote: false; text: string } | { quote: true; text: string };

/** Split text into plain runs and quoted spans (without their marks). */
export function splitQuotes(text: string): TextPart[] {
  const out: TextPart[] = [];
  let at = 0;
  for (const match of text.matchAll(QUOTE_RE)) {
    const inner = match.slice(1).find((group) => group !== undefined) ?? "";
    if (match.index > at) out.push({ quote: false, text: text.slice(at, match.index) });
    out.push({ quote: true, text: inner });
    at = match.index + match[0].length;
  }
  if (at < text.length) out.push({ quote: false, text: text.slice(at) });
  return out;
}

/** Apply `fn` to the text outside quoted spans; the quotes stay exactly as written. */
export function mapOutsideQuotes(text: string, fn: (plain: string) => string): string {
  let out = "";
  let at = 0;
  for (const match of text.matchAll(QUOTE_RE)) {
    out += fn(text.slice(at, match.index)) + match[0];
    at = match.index + match[0].length;
  }
  return out + fn(text.slice(at));
}

export function quotesIn(text: string): string[] {
  return splitQuotes(text)
    .filter((part) => part.quote)
    .map((part) => part.text);
}

function withoutQuotes(text: string): string {
  return splitQuotes(text)
    .filter((part) => !part.quote)
    .map((part) => part.text)
    .join(" ");
}

const FOLD: Record<string, string> = {
  "‘": "'",
  "’": "'",
  "‚": "'",
  "‛": "'",
  "“": '"',
  "”": '"',
  "„": '"',
  "«": '"',
  "»": '"',
};

/** Case, spacing and quote styles folded, so "Eu" and "eu  " match. */
export function normalizeWords(text: string): string {
  return text
    .normalize("NFC")
    .replace(/[‘’‚‛“”„«»]/gu, (c) => FOLD[c] ?? c)
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase();
}

const EDGE = /^[\s"'.,;:!?…()[\]-]+|[\s"'.,;:!?…()[\]-]+$/gu;
const WORD = /[\p{L}\p{N}]/u;

/** The person's words, folded, for looking quotes up. */
export interface WordCorpus {
  readonly text: string;
}

export function buildCorpus(texts: Iterable<string | null | undefined>): WordCorpus {
  const parts: string[] = [];
  for (const text of texts) if (text) parts.push(normalizeWords(text));
  // A line break between sources, so a quote never spans two records.
  return { text: `\n${parts.join("\n")}\n` };
}

/** Is `quote` in the corpus, word for word, at word boundaries? */
export function isVerbatim(corpus: WordCorpus, quote: string): boolean {
  const needle = normalizeWords(quote).replace(EDGE, "");
  if (!needle) return true;
  let from = 0;
  for (;;) {
    const at = corpus.text.indexOf(needle, from);
    if (at < 0) return false;
    const before = corpus.text[at - 1] ?? " ";
    const after = corpus.text[at + needle.length] ?? " ";
    if (!WORD.test(before) && !WORD.test(after)) return true;
    from = at + 1;
  }
}

/** The texts of an entry that a report may quote. */
export function entryTexts(entry: {
  title?: string | null;
  situation?: string | null;
  thoughts?: readonly string[] | null;
  emotions?: readonly Emotion[] | null;
  body?: string | null;
  behavior?: string | null;
  context?: string | null;
  notes?: string | null;
  hotThought?: string | null;
  evidenceFor?: string | null;
  evidenceAgainst?: string | null;
  alternative?: string | null;
  emotionsAfter?: readonly Emotion[] | null;
}): string[] {
  return [
    entry.title,
    entry.situation,
    ...(entry.thoughts ?? []),
    ...(entry.emotions ?? []).map((e) => e.name),
    entry.body,
    entry.behavior,
    entry.context,
    entry.notes,
    entry.hotThought,
    entry.evidenceFor,
    entry.evidenceAgainst,
    entry.alternative,
    ...(entry.emotionsAfter ?? []).map((e) => e.name),
  ].filter((t): t is string => typeof t === "string" && t.length > 0);
}

/** An entry as the check compares a moment with it. */
export interface CheckedEntry {
  id: string;
  occurredAt: string;
  thoughts: readonly string[];
  emotions: readonly Emotion[];
  body: string | null;
  hotThought: string | null;
  evidenceFor: string | null;
  evidenceAgainst: string | null;
  alternative: string | null;
  alternativeBelief: number | null;
  emotionsAfter: readonly Emotion[];
}

/** What the check knows of the diary. */
export interface ReportLedger {
  corpus: WordCorpus;
  entries: ReadonlyMap<string, CheckedEntry>;
  /** Current check-in notes by check-in id. */
  notes: ReadonlyMap<string, string | null>;
}

export type ProblemCode =
  | "quote_not_found"
  | "moment_entry_missing"
  | "moment_entry_changed"
  | "note_changed"
  | "states_a_cause"
  | "clinical_label"
  | "undated_observation"
  | "too_many_topics"
  | "too_many_moments"
  | "long_summary";

export interface ReportProblem {
  code: ProblemCode;
  section: ReportSection;
  /** The quote, word or item at fault. The person's words: show, never log. */
  detail: string | null;
}

export interface ReportCheck {
  /** Normalized quotes that were found word for word. */
  verified: ReadonlySet<string>;
  problems: ReportProblem[];
}

// Word boundaries that know accented letters (\b only knows ASCII).
const CAUSAL =
  /(?<![\p{L}\p{N}])(porque|por causa|causou|causad[oa]s?|devido a|levou a|fez com que|because|caused|due to|led to|a causa de|caus[oó]|debido a|llev[oó] a|hizo que)(?![\p{L}\p{N}])/giu;
const LABELS =
  /(?<![\p{L}\p{N}])(catastrofiz\p{L}*|catastrophiz\p{L}*|rumina[cç][aã]o|rumiaci[oó]n|rumination|evita[cç][aã]o|evitaci[oó]n|avoidance|transtorno\p{L}*|trastorno\p{L}*|disorder\p{L}*|depress[aã]o|depresi[oó]n|depression|depressiv\p{L}*|depresiv\p{L}*|depressive|burnout|tdah|adhd|bipolar|borderline|trauma\p{L}*|diagn[oó]stic\p{L}*|diagnos\p{L}*)(?![\p{L}\p{N}])/giu;

const SUMMARY_WORDS = 140;
const MAX_TOPICS = 6;
const MAX_MOMENTS = 6;

/** Every piece of prose in a report, with its section. */
export function proseOf(content: ReportContent): { section: ReportSection; text: string }[] {
  return [
    { section: "week", text: content.week },
    ...content.topics.map((t) => ({ section: "session" as const, text: t.text })),
    { section: "mood", text: content.mood },
    { section: "moments", text: content.momentsIntro },
    ...content.moments.flatMap((m) =>
      [m.title, m.happened, m.context, m.did]
        .filter((t): t is string => !!t)
        .map((text) => ({ section: "moments" as const, text })),
    ),
    ...content.patterns.flatMap((p) => [
      { section: "patterns" as const, text: p.when },
      { section: "patterns" as const, text: p.text },
    ]),
    ...content.helped.map((text) => ({ section: "helped" as const, text })),
  ];
}

function sameEmotions(a: readonly Emotion[], b: readonly Emotion[]): boolean {
  return (
    a.length === b.length &&
    a.every((e, i) => e.name === b[i]?.name && (e.intensity ?? null) === (b[i]?.intensity ?? null))
  );
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function momentMatches(moment: ReportMoment, entry: CheckedEntry): boolean {
  return (
    sameList(moment.thoughts, entry.thoughts) &&
    sameEmotions(moment.felt, entry.emotions) &&
    sameEmotions(moment.feltAfter, entry.emotionsAfter) &&
    moment.body === entry.body &&
    moment.hotThought === entry.hotThought &&
    moment.evidenceFor === entry.evidenceFor &&
    moment.evidenceAgainst === entry.evidenceAgainst &&
    moment.alternative === entry.alternative &&
    moment.belief === entry.alternativeBelief
  );
}

export function checkReport(content: ReportContent, ledger: ReportLedger): ReportCheck {
  const problems: ReportProblem[] = [];
  const verified = new Set<string>();
  const seen = new Set<string>();
  const prose = proseOf(content);

  for (const { section, text } of prose) {
    for (const quote of quotesIn(text)) {
      const key = normalizeWords(quote);
      if (isVerbatim(ledger.corpus, quote)) verified.add(key);
      else if (!seen.has(`${section}:${key}`)) {
        seen.add(`${section}:${key}`);
        problems.push({ code: "quote_not_found", section, detail: quote });
      }
    }
    const plain = withoutQuotes(text);
    for (const match of new Set([...plain.matchAll(CAUSAL)].map((m) => m[0].toLocaleLowerCase()))) {
      problems.push({ code: "states_a_cause", section, detail: match });
    }
    for (const match of new Set([...plain.matchAll(LABELS)].map((m) => m[0].toLocaleLowerCase()))) {
      problems.push({ code: "clinical_label", section, detail: match });
    }
  }

  // The moments' own words come from their entries; they must still match.
  for (const moment of content.moments) {
    const entry = ledger.entries.get(moment.entryId);
    if (!entry) problems.push({ code: "moment_entry_missing", section: "moments", detail: moment.title });
    else if (!momentMatches(moment, entry))
      problems.push({ code: "moment_entry_changed", section: "moments", detail: moment.title });
    for (const words of [...moment.thoughts, moment.hotThought, moment.alternative]) {
      if (words && entry) verified.add(normalizeWords(words));
    }
  }
  for (const note of content.notes) {
    if (ledger.notes.get(note.checkinId) !== note.note)
      problems.push({ code: "note_changed", section: "mood", detail: note.note });
    else verified.add(normalizeWords(note.note));
  }

  for (const pattern of content.patterns) {
    if (!/\p{N}/u.test(withoutQuotes(pattern.when))) {
      problems.push({ code: "undated_observation", section: "patterns", detail: pattern.text });
    }
  }
  if (content.topics.length > MAX_TOPICS)
    problems.push({ code: "too_many_topics", section: "session", detail: null });
  if (content.moments.length > MAX_MOMENTS)
    problems.push({ code: "too_many_moments", section: "moments", detail: null });
  if (content.week.split(/\s+/u).filter(Boolean).length > SUMMARY_WORDS)
    problems.push({ code: "long_summary", section: "week", detail: null });

  return { verified, problems };
}

/** Is this quoted span one the check found in the diary? */
export function isVerified(check: Pick<ReportCheck, "verified">, quote: string): boolean {
  return check.verified.has(normalizeWords(quote));
}
