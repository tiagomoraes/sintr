/**
 * The Therapy calendar's arithmetic, for the page and the browser alike:
 * months as `YYYY-MM`, days as `YYYY-MM-DD` (the person's own days, already
 * read in their time zone), and the address that holds what is open.
 * Nothing here knows a time zone; the server has placed every session on
 * its local day before the browser sees it.
 */

const pad = (n: number) => String(n).padStart(2, "0");

function parts(day: string): [number, number, number] {
  return day.split("-").map(Number) as [number, number, number];
}

export function addDays(day: string, days: number): string {
  const [y, m, d] = parts(day);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** 0 = Sunday ... 6 = Saturday. */
export function weekdayOf(day: string): number {
  const [y, m, d] = parts(day);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function monthOf(day: string): string {
  return day.slice(0, 7);
}

export function addMonths(month: string, months: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const date = new Date(Date.UTC(y, m - 1 + months, 1));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
}

export function isMonth(value: string | null | undefined): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function isDay(value: string | null | undefined): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return addDays(value, 0) === value;
}

/**
 * The weeks a month's grid shows, each seven days long, from the week that
 * holds its first day to the week that holds its last. `weekStart` is the
 * first column (0 = Sunday, 1 = Monday), as the page's language has it.
 */
export function monthWeeks(month: string, weekStart: number): string[][] {
  const first = `${month}-01`;
  const last = addDays(`${addMonths(month, 1)}-01`, -1);
  let day = addDays(first, -((weekdayOf(first) - weekStart + 7) % 7));
  const weeks: string[][] = [];
  while (day <= last) {
    const week: string[] = [];
    for (let i = 0; i < 7; i += 1, day = addDays(day, 1)) week.push(day);
    weeks.push(week);
  }
  return weeks;
}

/** The first day of the week in a language (`Intl.Locale` week info), Monday when it does not say. */
export function weekStartOf(intl: string): number {
  try {
    const locale = new Intl.Locale(intl) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
      weekInfo?: { firstDay: number };
    };
    const firstDay = (locale.getWeekInfo?.() ?? locale.weekInfo)?.firstDay;
    return typeof firstDay === "number" ? firstDay % 7 : 1;
  } catch {
    return 1;
  }
}

/** A session in the address: its series and its own day in it. */
export function sessionKey(seriesId: string, occursOn: string): string {
  return `${seriesId}.${occursOn}`;
}

export function parseSessionKey(
  key: string | null | undefined,
): { seriesId: string; occursOn: string } | null {
  const match = typeof key === "string" ? /^([0-9a-f-]{36})\.(\d{4}-\d{2}-\d{2})$/.exec(key) : null;
  return match && isDay(match[2]) ? { seriesId: match[1]!, occursOn: match[2] } : null;
}

/** What the calendar shows, as the address holds it, so a reload or the back gesture keeps it. */
export interface CalendarState {
  month: string;
  day: string | null;
  session: string | null;
  /** In a session: changing or cancelling it. */
  doing: "change" | "cancel" | null;
  /** Adding a session, on this day. */
  add: string | null;
}

export function calendarState(params: { get(name: string): string | null }, today: string): CalendarState {
  const month = params.get("month");
  const day = params.get("day");
  const add = params.get("add");
  const doing = params.get("do");
  const session = params.get("session");
  return {
    month: isMonth(month) ? month : isDay(day) ? monthOf(day) : monthOf(today),
    day: isDay(day) ? day : null,
    session: parseSessionKey(session) ? session : null,
    doing: doing === "change" || doing === "cancel" ? doing : null,
    add: isDay(add) ? add : null,
  };
}

/** The address of a state of the calendar, on the Therapy page. A link adds `#sessions`, to open at it. */
export function calendarHref(state: Partial<CalendarState>): string {
  const query = new URLSearchParams();
  if (state.month) query.set("month", state.month);
  if (state.day) query.set("day", state.day);
  if (state.session) query.set("session", state.session);
  if (state.session && state.doing) query.set("do", state.doing);
  if (state.add) query.set("add", state.add);
  const search = query.toString();
  return `/therapy${search ? `?${search}` : ""}`;
}

/** Why a calendar form could not be kept, as a code the sheet says in a sentence (`therapy.calendar.problems`). */
export const SESSION_PROBLEMS = [
  "day",
  "time",
  "repeat",
  "weekdays",
  "which",
  "gone",
  "passed",
  "timezone",
  "form",
] as const;
export type SessionProblem = (typeof SESSION_PROBLEMS)[number];

export function parseProblem(value: string | null | undefined): SessionProblem | null {
  return (SESSION_PROBLEMS as readonly string[]).includes(value ?? "") ? (value as SessionProblem) : null;
}
