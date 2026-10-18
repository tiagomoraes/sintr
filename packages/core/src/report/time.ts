/**
 * Wall-clock arithmetic in a person's time zone. Days are `YYYY-MM-DD`
 * strings, so date math never passes through the server's own zone, and an
 * instant is found from a wall-clock time with two passes over the offset,
 * which settles across a daylight-saving change.
 */

export interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday ... 6 = Saturday. */
  weekday: number;
}

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let found = formatters.get(timeZone);
  if (!found) {
    found = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    formatters.set(timeZone, found);
  }
  return found;
}

export function localParts(date: Date, timeZone: string): LocalParts {
  const out: Record<string, string> = {};
  for (const part of formatter(timeZone).formatToParts(date)) out[part.type] = part.value;
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    hour: Number(out.hour),
    minute: Number(out.minute),
    second: Number(out.second),
    weekday: WEEKDAY_INDEX[out.weekday ?? ""] ?? 0,
  };
}

function offsetAt(instant: number, timeZone: string): number {
  const p = localParts(new Date(instant), timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** The instant at a wall-clock time in `timeZone`. */
export function zonedTime(
  wall: { year: number; month: number; day: number; hour?: number; minute?: number },
  timeZone: string,
): Date {
  const utc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour ?? 0, wall.minute ?? 0);
  let guess = utc - offsetAt(utc, timeZone);
  guess = utc - offsetAt(guess, timeZone);
  return new Date(guess);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** The local day of an instant, as `YYYY-MM-DD`. */
export function localDay(date: Date, timeZone: string): string {
  const p = localParts(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

function parseDay(day: string): { year: number; month: number; day: number } {
  const [year, month, date] = day.split("-").map(Number) as [number, number, number];
  return { year, month, day: date };
}

/** Calendar arithmetic on `YYYY-MM-DD`, independent of any zone. */
export function addDays(day: string, days: number): string {
  const p = parseDay(day);
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day + days));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** 0 = Sunday ... 6 = Saturday. */
export function weekdayOf(day: string): number {
  const p = parseDay(day);
  return new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
}

/** Midnight at the start of a local day. */
export function dayStart(day: string, timeZone: string): Date {
  return zonedTime(parseDay(day), timeZone);
}

/** The local days from `first` to `last`, both included. */
export function daysBetween(first: string, last: string): string[] {
  const out: string[] = [];
  for (let day = first; day <= last; day = addDays(day, 1)) out.push(day);
  return out;
}

/** The ISO week of a day: `YYYY-Www`. */
export function isoWeek(day: string): string {
  const p = parseDay(day);
  const date = new Date(Date.UTC(p.year, p.month - 1, p.day));
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - weekday);
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((date.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${pad(week)}`;
}

/** Is this a time zone the platform knows? */
export function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
