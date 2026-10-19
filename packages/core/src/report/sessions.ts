/**
 * The therapy calendar: the sessions a person added, each a single date or
 * a rhythm (every week, every two weeks, every fifteen days, on chosen
 * weekdays), and the sessions of a rhythm they moved or cancelled one at a
 * time. Days are local `YYYY-MM-DD` strings and times `HH:MM`, read in the
 * person's time zone, as the weekly slot was: changing zone moves every
 * session with it, keeping its wall-clock time.
 *
 * A session is named by its series and its own day in that series
 * (`occursOn`), never by its nearness to anything: moving or cancelling
 * one is a change kept for exactly that session (DECISIONS 113).
 */
import { addDays, dayDiff, localDay, weekdayOf, zonedTime } from "./time";

export const SESSION_REPEATS = ["once", "weekly", "fortnightly", "every_15_days", "weekdays"] as const;
export type SessionRepeat = (typeof SESSION_REPEATS)[number];

/** Days between two sessions of a rhythm that repeats by an interval. */
export const REPEAT_INTERVAL: Readonly<Record<"weekly" | "fortnightly" | "every_15_days", number>> = {
  weekly: 7,
  fortnightly: 14,
  every_15_days: 15,
};

/** A session the person added: one date, or the first of a rhythm. */
export interface SessionSeries {
  id: string;
  /** The first session's local day. */
  startsOn: string;
  /** `HH:MM`, local. */
  time: string;
  repeat: SessionRepeat;
  /** For `weekdays`: the days of the week it falls on (0 = Sunday ... 6 = Saturday), sorted. Empty otherwise. */
  weekdays: number[];
  /** The rhythm holds no session on or after this local day; null while it goes on. */
  stopsOn: string | null;
}

/** One session of a rhythm, moved or cancelled on its own. */
export interface SessionChange {
  seriesId: string;
  /** The session's own day in its series: which one the person meant. */
  occursOn: string;
  /** Where it moved to; null when it was cancelled. */
  movedTo: { on: string; time: string } | null;
}

export interface SessionCalendar {
  series: readonly SessionSeries[];
  changes: readonly SessionChange[];
}

/** One session as it falls. */
export interface Session {
  seriesId: string;
  /** Its own day in the series, which names it. */
  occursOn: string;
  /** The local day it falls on: its own day, or where it moved to. */
  on: string;
  time: string;
  at: Date;
  moved: boolean;
  cancelled: boolean;
}

/** The longest stretch a calendar is read over at once, in days. */
const MAX_SPAN = 800;

function clock(time: string): { hour: number; minute: number } {
  const [hour, minute] = time.split(":").map(Number) as [number, number];
  return { hour, minute };
}

function instant(day: string, time: string, timeZone: string): Date {
  const [year, month, date] = day.split("-").map(Number) as [number, number, number];
  return zonedTime({ year, month, day: date, ...clock(time) }, timeZone);
}

/** The series as stored: a `weekdays` rhythm starts on one of its days, and only it keeps weekdays. */
export function normalizeSeries<T extends Omit<SessionSeries, "id" | "stopsOn">>(series: T): T {
  if (series.repeat !== "weekdays") return { ...series, weekdays: [] };
  const weekdays = [...new Set(series.weekdays)].sort((a, b) => a - b);
  let startsOn = series.startsOn;
  for (let i = 0; i < 7 && weekdays.length > 0 && !weekdays.includes(weekdayOf(startsOn)); i += 1) {
    startsOn = addDays(startsOn, 1);
  }
  return { ...series, weekdays, startsOn };
}

/** The series' own days within [first, last], both included. */
export function seriesDays(series: SessionSeries, first: string, last: string): string[] {
  const lower = series.startsOn > first ? series.startsOn : first;
  const stop = series.stopsOn ? addDays(series.stopsOn, -1) : null;
  const upper = stop && stop < last ? stop : last;
  if (lower > upper || dayDiff(lower, upper) > MAX_SPAN) return [];
  if (series.repeat === "once") return series.startsOn >= lower ? [series.startsOn] : [];
  const out: string[] = [];
  if (series.repeat === "weekdays") {
    for (let day = lower; day <= upper; day = addDays(day, 1)) {
      if (series.weekdays.includes(weekdayOf(day))) out.push(day);
    }
    return out;
  }
  const every = REPEAT_INTERVAL[series.repeat];
  const skip = Math.ceil(dayDiff(series.startsOn, lower) / every);
  for (let day = addDays(series.startsOn, skip * every); day <= upper; day = addDays(day, every)) {
    out.push(day);
  }
  return out;
}

/** Is `day` one of the series' own days? */
export function isSeriesDay(series: SessionSeries, day: string): boolean {
  return seriesDays(series, day, day).length === 1;
}

/** The series' first own day on or after `from`, within a year, or null. */
export function nextSeriesDay(series: SessionSeries, from: string): string | null {
  return seriesDays(series, from, addDays(from, 366))[0] ?? null;
}

/**
 * Every session that falls on a local day within [first, last]: each at
 * its own day or where it moved to, and the cancelled ones at their own
 * day, marked, so the calendar can show the gap. Sorted by when they fall.
 */
export function sessionsOn(
  calendar: SessionCalendar,
  timeZone: string,
  first: string,
  last: string,
): Session[] {
  const changes = new Map(
    calendar.changes.map((change) => [`${change.seriesId}/${change.occursOn}`, change]),
  );
  const out: Session[] = [];
  for (const series of calendar.series) {
    for (const day of seriesDays(series, first, last)) {
      const change = changes.get(`${series.id}/${day}`);
      if (change?.movedTo) continue;
      out.push({
        seriesId: series.id,
        occursOn: day,
        on: day,
        time: series.time,
        at: instant(day, series.time, timeZone),
        moved: false,
        cancelled: change !== undefined,
      });
    }
  }
  const byId = new Map(calendar.series.map((series) => [series.id, series]));
  for (const change of calendar.changes) {
    const series = byId.get(change.seriesId);
    const to = change.movedTo;
    // A change names one of its series' own days; anything else is not a session.
    if (!series || !to || to.on < first || to.on > last || !isSeriesDay(series, change.occursOn)) continue;
    out.push({
      seriesId: series.id,
      occursOn: change.occursOn,
      on: to.on,
      time: to.time,
      at: instant(to.on, to.time, timeZone),
      moved: true,
      cancelled: false,
    });
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime() || a.seriesId.localeCompare(b.seriesId));
}

/**
 * The sessions that will be held (not cancelled) in [from, to), one per
 * moment: two sessions at the same moment are one session for the report.
 */
export function heldSessions(calendar: SessionCalendar, timeZone: string, from: Date, to: Date): Session[] {
  const all = sessionsOn(
    calendar,
    timeZone,
    addDays(localDay(from, timeZone), -1),
    addDays(localDay(to, timeZone), 1),
  );
  const out: Session[] = [];
  for (const session of all) {
    if (session.cancelled || session.at < from || session.at >= to) continue;
    if (out.at(-1)?.at.getTime() === session.at.getTime()) continue;
    out.push(session);
  }
  return out;
}

/** The session `ref` names, as it falls now (moved, cancelled or as its rhythm has it), or null. */
export function findSession(
  calendar: SessionCalendar,
  timeZone: string,
  ref: { seriesId: string; occursOn: string },
): Session | null {
  const series = calendar.series.find((candidate) => candidate.id === ref.seriesId);
  if (!series || !isSeriesDay(series, ref.occursOn)) return null;
  const change = calendar.changes.find(
    (candidate) => candidate.seriesId === ref.seriesId && candidate.occursOn === ref.occursOn,
  );
  const on = change?.movedTo?.on ?? ref.occursOn;
  const time = change?.movedTo?.time ?? series.time;
  return {
    seriesId: series.id,
    occursOn: ref.occursOn,
    on,
    time,
    at: instant(on, time, timeZone),
    moved: Boolean(change?.movedTo),
    cancelled: change !== undefined && !change.movedTo,
  };
}
