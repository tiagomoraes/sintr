/**
 * How records read in a tool result: the person's words exactly as stored,
 * times both as an instant and as the wall clock where the person is, and
 * a link to the same record in the app. Empty fields are left out, so the
 * agent never mistakes an empty field for something the person said.
 */
import { localDay, localParts, weekdayOf, type Checkin, type Entry, type SessionSeries } from "@sintr/core";

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const pad = (value: number) => String(value).padStart(2, "0");

/** "Tuesday 2026-10-14 19:40", in the person's time zone. */
export function wallClock(date: Date, timeZone: string): string {
  const p = localParts(date, timeZone);
  return `${WEEKDAYS[p.weekday]} ${localDay(date, timeZone)} ${pad(p.hour)}:${pad(p.minute)}`;
}

/** A moment as both the agent and the person read it. */
export function moment(date: Date, timeZone: string): { at: string; local: string } {
  return { at: date.toISOString(), local: wallClock(date, timeZone) };
}

/** A session or a rhythm of the therapy calendar, said plainly: "Every two weeks on Tuesday at 18:00". */
export function rhythmOf(series: SessionSeries): string {
  const day = WEEKDAYS[weekdayOf(series.startsOn)];
  switch (series.repeat) {
    case "once":
      return `Once, on ${day} ${series.startsOn} at ${series.time}`;
    case "weekly":
      return `Every week on ${day} at ${series.time}`;
    case "fortnightly":
      return `Every two weeks on ${day} at ${series.time}, from ${series.startsOn}`;
    case "every_15_days":
      return `Every 15 days at ${series.time}, from ${series.startsOn}`;
    case "weekdays":
      return `Every week on ${series.weekdays.map((d) => WEEKDAYS[d]).join(" and ")} at ${series.time}`;
  }
}

function present<T extends Record<string, unknown>>(fields: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, value] of Object.entries(fields) as [keyof T, unknown][]) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    out[key] = value as T[keyof T];
  }
  return out;
}

/** The title an entry is known by: its own, or the start of what happened. */
export function entryTitle(entry: Pick<Entry, "title" | "situation">): string | null {
  return entry.title ?? (entry.situation ? entry.situation.slice(0, 120) : null);
}

export function entryView(entry: Entry, timeZone: string, appUrl: URL) {
  return {
    id: entry.id,
    when: moment(entry.occurredAt, timeZone),
    ...present({
      title: entry.title,
      situation: entry.situation,
      thoughts: entry.thoughts,
      emotions: entry.emotions,
      body: entry.body,
      behavior: entry.behavior,
      context: entry.context,
      tags: entry.tags,
      notes: entry.notes,
      hotThought: entry.hotThought,
      evidenceFor: entry.evidenceFor,
      evidenceAgainst: entry.evidenceAgainst,
      alternative: entry.alternative,
      alternativeBelief: entry.alternativeBelief,
      emotionsAfter: entry.emotionsAfter,
    }),
    link: new URL(`/entries/${entry.id}`, appUrl).toString(),
  };
}

export function checkinView(checkin: Checkin, timeZone: string, appUrl: URL) {
  return {
    id: checkin.id,
    when: moment(checkin.occurredAt, timeZone),
    ...present({
      mood: checkin.mood,
      energy: checkin.energy,
      anxiety: checkin.anxiety,
      sleepHours: checkin.sleepHours,
      sleepQuality: checkin.sleepQuality,
      note: checkin.note,
    }),
    link: new URL(`/checkins/${checkin.id}`, appUrl).toString(),
  };
}

/** One decimal at most: the agent reads averages, not floating point noise. */
export function rounded(value: number | null): number | null {
  return value === null ? null : Math.round(value * 10) / 10;
}
