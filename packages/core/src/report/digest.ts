/**
 * The digest of one report period: the agent pack's `week_collect.py` on
 * the database. Deterministic, and it never interprets: the period's
 * entries and check-ins, with the mechanical numbers (averages with their
 * number of days, sleep, counts, emotion and tag frequencies) and the
 * header the report writer needs. A day without a check-in stays empty;
 * nothing is estimated.
 */
import type { Checkin, Emotion, Entry } from "../domain";
import type { ReportPeriod } from "./period";
import { addDays, dayStart, daysBetween, localDay, weekdayOf } from "./time";

const HOUR = 3_600_000;
/** Weeks the chart shows, this period's included. */
export const CHART_WEEKS = 4;

export interface DigestDay {
  /** Local `YYYY-MM-DD`. */
  day: string;
  /** 0 = Sunday ... 6 = Saturday. */
  weekday: number;
  /** The day's check-ins, averaged when there are several; null when none. */
  mood: number | null;
  energy: number | null;
  anxiety: number | null;
  sleepHours: number | null;
  /** Entries recorded that day. */
  entries: number;
}

export interface DigestMeasure {
  /** Over the days with a value. */
  average: number | null;
  /** How many days the average is over. */
  days: number;
  min: number | null;
  max: number | null;
  /** The same average over the 7 days before the period, if any. */
  previous: number | null;
}

export type MeasureKey = "mood" | "energy" | "anxiety" | "sleepHours";

/** The numbers a report prints. Computed, never typed; frozen at approval. */
export interface DigestNumbers {
  timeZone: string;
  /** The local days the report shows. */
  days: DigestDay[];
  /** Earlier weeks and then this period's days, for the chart. */
  history: DigestDay[];
  measures: Record<MeasureKey, DigestMeasure>;
  counts: { entries: number; checkins: number; daysWithCheckin: number; days: number };
}

/** An entry as the report reads it: the person's words, unchanged. */
export interface DigestEntry {
  id: string;
  occurredAt: string;
  day: string;
  title: string | null;
  situation: string | null;
  thoughts: string[];
  emotions: Emotion[];
  body: string | null;
  behavior: string | null;
  context: string | null;
  tags: string[];
  notes: string | null;
  hotThought: string | null;
  evidenceFor: string | null;
  evidenceAgainst: string | null;
  alternative: string | null;
  alternativeBelief: number | null;
  emotionsAfter: Emotion[];
  peakIntensity: number | null;
}

export interface DigestNote {
  checkinId: string;
  day: string;
  note: string;
}

export interface Digest extends DigestNumbers {
  kind: ReportPeriod["kind"];
  label: string;
  /** ISO 8601. */
  start: string;
  end: string;
  session: string | null;
  entries: DigestEntry[];
  /** Check-in notes in the period, oldest first, verbatim. */
  notes: DigestNote[];
  emotions: { name: string; count: number; average: number | null; max: number | null }[];
  tags: { name: string; count: number }[];
}

function mean(values: readonly number[]): number | null {
  return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
}

function byDay(checkins: readonly Checkin[], timeZone: string): Map<string, Checkin[]> {
  const out = new Map<string, Checkin[]>();
  for (const checkin of checkins) {
    const day = localDay(checkin.occurredAt, timeZone);
    out.set(day, [...(out.get(day) ?? []), checkin]);
  }
  return out;
}

function dayRow(day: string, checkins: readonly Checkin[], entries: number): DigestDay {
  const value = (key: MeasureKey) =>
    mean(checkins.map((c) => c[key]).filter((v): v is number => v !== null && v !== undefined));
  return {
    day,
    weekday: weekdayOf(day),
    mood: value("mood"),
    energy: value("energy"),
    anxiety: value("anxiety"),
    sleepHours: value("sleepHours"),
    entries,
  };
}

/**
 * The local days a period shows: every day it touches, except a partial day
 * at either end that it covers for less than 12 hours and that holds no
 * record (a session report starts and ends at the report hour).
 */
export function periodDays(
  start: Date,
  end: Date,
  timeZone: string,
  withData: ReadonlySet<string>,
): string[] {
  const first = localDay(start, timeZone);
  const last = localDay(new Date(end.getTime() - 1), timeZone);
  return daysBetween(first, last).filter((day) => {
    const from = dayStart(day, timeZone).getTime();
    const to = dayStart(addDays(day, 1), timeZone).getTime();
    const covered = Math.min(end.getTime(), to) - Math.max(start.getTime(), from);
    return covered >= 12 * HOUR || withData.has(day);
  });
}

function measure(days: readonly DigestDay[], previous: readonly DigestDay[], key: MeasureKey): DigestMeasure {
  const values = days.map((d) => d[key]).filter((v): v is number => v !== null);
  return {
    average: mean(values),
    days: values.length,
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    previous: mean(previous.map((d) => d[key]).filter((v): v is number => v !== null)),
  };
}

function snapshot(entry: Entry, timeZone: string): DigestEntry {
  return {
    id: entry.id,
    occurredAt: entry.occurredAt.toISOString(),
    day: localDay(entry.occurredAt, timeZone),
    title: entry.title,
    situation: entry.situation,
    thoughts: entry.thoughts ?? [],
    emotions: entry.emotions ?? [],
    body: entry.body,
    behavior: entry.behavior,
    context: entry.context,
    tags: entry.tags ?? [],
    notes: entry.notes,
    hotThought: entry.hotThought,
    evidenceFor: entry.evidenceFor,
    evidenceAgainst: entry.evidenceAgainst,
    alternative: entry.alternative,
    alternativeBelief: entry.alternativeBelief,
    emotionsAfter: entry.emotionsAfter ?? [],
    peakIntensity: entry.peakIntensity,
  };
}

/** The earliest moment whose check-ins the digest needs (chart and the week before). */
export function historyStart(period: Pick<ReportPeriod, "start">, timeZone: string): Date {
  const firstDay = localDay(period.start, timeZone);
  return dayStart(addDays(firstDay, -7 * (CHART_WEEKS - 1) - 1), timeZone);
}

/**
 * Build the digest from the records around a period. `entries` and
 * `checkins` may reach before the period (the chart and the week before
 * use earlier check-ins); only the period's own are listed and counted.
 */
export function buildDigest(input: {
  period: ReportPeriod;
  timeZone: string;
  entries: readonly Entry[];
  checkins: readonly Checkin[];
}): Digest {
  const { period, timeZone } = input;
  const inPeriod = (date: Date) => date >= period.start && date < period.end;
  const entries = input.entries.filter((e) => inPeriod(e.occurredAt));
  entries.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  const checkins = input.checkins.filter((c) => inPeriod(c.occurredAt));
  checkins.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

  const entriesPerDay = new Map<string, number>();
  for (const entry of entries) {
    const day = localDay(entry.occurredAt, timeZone);
    entriesPerDay.set(day, (entriesPerDay.get(day) ?? 0) + 1);
  }
  const periodCheckins = byDay(checkins, timeZone);
  const withData = new Set([...entriesPerDay.keys(), ...periodCheckins.keys()]);
  const shown = periodDays(period.start, period.end, timeZone, withData);
  const days = shown.map((day) => dayRow(day, periodCheckins.get(day) ?? [], entriesPerDay.get(day) ?? 0));

  // The 7 days before the period, for "the week before".
  const before = input.checkins.filter(
    (c) => c.occurredAt < period.start && c.occurredAt.getTime() >= period.start.getTime() - 7 * 24 * HOUR,
  );
  const previousDays = [...byDay(before, timeZone).entries()].map(([day, list]) => dayRow(day, list, 0));

  // The chart: up to three earlier weeks (from the first day with a check-in), then the period.
  const firstShown = shown[0] ?? localDay(period.start, timeZone);
  const earlier = byDay(
    input.checkins.filter((c) => c.occurredAt < period.start),
    timeZone,
  );
  const recorded = [...earlier.keys()].filter((day) => day < firstShown).sort();
  let chartFirst = addDays(firstShown, -7 * (CHART_WEEKS - 1));
  if (recorded.length) chartFirst = recorded[0]! > chartFirst ? recorded[0]! : chartFirst;
  else chartFirst = firstShown;
  const history = [
    ...(chartFirst < firstShown ? daysBetween(chartFirst, addDays(firstShown, -1)) : []).map((day) =>
      dayRow(day, earlier.get(day) ?? [], 0),
    ),
    ...days,
  ];

  const emotions = new Map<string, { name: string; values: number[]; count: number }>();
  const tags = new Map<string, { name: string; count: number }>();
  for (const entry of entries) {
    for (const emotion of entry.emotions ?? []) {
      const key = emotion.name.toLocaleLowerCase();
      const item = emotions.get(key) ?? { name: emotion.name, values: [], count: 0 };
      item.count += 1;
      if (emotion.intensity !== null) item.values.push(emotion.intensity);
      emotions.set(key, item);
    }
    for (const tag of entry.tags ?? []) {
      const key = tag.toLocaleLowerCase();
      const item = tags.get(key) ?? { name: tag, count: 0 };
      item.count += 1;
      tags.set(key, item);
    }
  }

  return {
    kind: period.kind,
    label: period.label,
    start: period.start.toISOString(),
    end: period.end.toISOString(),
    session: period.session ? period.session.toISOString() : null,
    timeZone,
    days,
    history,
    measures: {
      mood: measure(days, previousDays, "mood"),
      energy: measure(days, previousDays, "energy"),
      anxiety: measure(days, previousDays, "anxiety"),
      sleepHours: measure(days, previousDays, "sleepHours"),
    },
    counts: {
      entries: entries.length,
      checkins: checkins.length,
      daysWithCheckin: days.filter(
        (d) => d.mood !== null || d.energy !== null || d.anxiety !== null || d.sleepHours !== null,
      ).length,
      days: days.length,
    },
    entries: entries.map((entry) => snapshot(entry, timeZone)),
    notes: checkins
      .filter((c) => c.note !== null && c.note.trim() !== "")
      .map((c) => ({ checkinId: c.id, day: localDay(c.occurredAt, timeZone), note: c.note! })),
    emotions: [...emotions.values()]
      .map((item) => ({
        name: item.name,
        count: item.count,
        average: mean(item.values),
        max: item.values.length ? Math.max(...item.values) : null,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    tags: [...tags.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  };
}

/** Only the numbers, to freeze into a report when the person approves it. */
export function digestNumbers(digest: Digest): DigestNumbers {
  return {
    timeZone: digest.timeZone,
    days: digest.days,
    history: digest.history,
    measures: digest.measures,
    counts: digest.counts,
  };
}
