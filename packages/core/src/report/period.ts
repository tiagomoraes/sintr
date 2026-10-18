/**
 * When a report is prepared and which days it covers: the agent pack's
 * `week_collect.py` period rules, on the database.
 *
 * - A report is for a therapy session. It is prepared `report_lead` (one
 *   hour by default) before the session and covers the days since the
 *   previous report ended, up to that moment: consecutive periods meet
 *   exactly, so nothing is lost and nothing is counted twice.
 * - The first report covers the 7 days before. After a long pause a period
 *   reaches back at most four weeks.
 * - Without a session, a calendar week (Monday to Sunday) is the period.
 * - A session that moved (a new weekly day or time, or a one-off date)
 *   moves the preparation with it.
 */
import type { ReportStatus } from "../domain";
import { addDays, dayStart, isoWeek, localDay, localParts, weekdayOf, zonedTime } from "./time";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
export const FIRST_PERIOD_DAYS = 7;
export const MAX_PERIOD_DAYS = 28;

/** The therapy schedule, as `therapy_settings` holds it. */
export interface SessionSchedule {
  /** 0 = Sunday ... 6 = Saturday, in the person's time zone. */
  sessionDay: number | null;
  /** `HH:MM`, in the person's time zone. */
  sessionTime: string | null;
  /** A one-off date for the next session, when it moved. */
  nextSessionAt: Date | null;
  reportLeadMinutes: number;
}

export interface ReportPeriod {
  kind: "session" | "week";
  /** The session's local date (`YYYY-MM-DD`), or the ISO week (`YYYY-Www`). */
  label: string;
  /** Inclusive. */
  start: Date;
  /** Exclusive: the moment the report is prepared for. */
  end: Date;
  session: Date | null;
}

/** What the planner needs to know of a report already prepared. */
export interface KnownReport {
  id: string;
  status: ReportStatus;
  sessionAt: Date | null;
  periodStart: Date;
  periodEnd: Date;
  editedAt: Date | null;
}

function clock(value: string | null): { hour: number; minute: number } | null {
  const match = value ? /^(\d{2}):(\d{2})/.exec(value) : null;
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour < 24 && minute < 60 ? { hour, minute } : null;
}

export function hasWeeklySchedule(schedule: SessionSchedule): boolean {
  return schedule.sessionDay !== null && clock(schedule.sessionTime) !== null;
}

/** Weekly sessions in [from, to), in the person's time zone. */
export function weeklySessions(schedule: SessionSchedule, timeZone: string, from: Date, to: Date): Date[] {
  const time = clock(schedule.sessionTime);
  if (schedule.sessionDay === null || !time) return [];
  const out: Date[] = [];
  let day = addDays(localDay(from, timeZone), -1);
  const lastDay = addDays(localDay(to, timeZone), 1);
  while (weekdayOf(day) !== schedule.sessionDay) day = addDays(day, 1);
  for (; day <= lastDay; day = addDays(day, 7)) {
    const [year, month, date] = day.split("-").map(Number) as [number, number, number];
    const at = zonedTime({ year, month, day: date, ...time }, timeZone);
    if (at >= from && at < to) out.push(at);
  }
  return out;
}

/**
 * Every session in [from, to): the weekly ones, except the one a one-off
 * date replaces (the weekly session nearest to it, within half a week),
 * plus that one-off date.
 */
export function scheduledSessions(schedule: SessionSchedule, timeZone: string, from: Date, to: Date): Date[] {
  const override = schedule.nextSessionAt;
  if (!override) return weeklySessions(schedule, timeZone, from, to);
  // Look around the override as well, so the session it replaces is known
  // even when it falls outside [from, to).
  const around = weeklySessions(
    schedule,
    timeZone,
    new Date(Math.min(from.getTime(), override.getTime()) - 4 * DAY),
    new Date(Math.max(to.getTime(), override.getTime()) + 4 * DAY),
  );
  let replaced: Date | null = null;
  for (const at of around) {
    const distance = Math.abs(at.getTime() - override.getTime());
    if (
      distance <= 3.5 * DAY &&
      (!replaced || distance < Math.abs(replaced.getTime() - override.getTime()))
    ) {
      replaced = at;
    }
  }
  const sessions = around.filter((at) => at.getTime() !== replaced?.getTime());
  sessions.push(override);
  return sessions.filter((at) => at >= from && at < to).sort((a, b) => a.getTime() - b.getTime());
}

/** The first session that has not started yet, or null without a schedule. */
export function upcomingSession(schedule: SessionSchedule, timeZone: string, now: Date): Date | null {
  const later = scheduledSessions(
    schedule,
    timeZone,
    new Date(now.getTime() + 1),
    new Date(now.getTime() + 15 * DAY),
  );
  return later[0] ?? null;
}

/** Is `at` one of the sessions the schedule holds now? */
export function inSchedule(schedule: SessionSchedule, timeZone: string, at: Date): boolean {
  return scheduledSessions(
    schedule,
    timeZone,
    new Date(at.getTime() - MINUTE),
    new Date(at.getTime() + MINUTE),
  ).some((session) => session.getTime() === at.getTime());
}

/** When the report for `session` is prepared. */
export function preparationTime(schedule: SessionSchedule, session: Date): Date {
  return new Date(session.getTime() - schedule.reportLeadMinutes * MINUTE);
}

/**
 * Where a period that ends at `end` starts: where the previous report ended
 * (nothing lost, nothing repeated), at most four weeks back; the first
 * report covers the 7 days before.
 */
export function periodStart(end: Date, previousEnd: Date | null): Date {
  const earliest = end.getTime() - MAX_PERIOD_DAYS * DAY;
  // Already covered up to (or past) `end`: the start meets the end, and there is nothing to prepare.
  if (previousEnd && previousEnd >= end) return previousEnd;
  if (previousEnd) return new Date(Math.max(previousEnd.getTime(), earliest));
  return new Date(end.getTime() - FIRST_PERIOD_DAYS * DAY);
}

export function sessionPeriod(
  session: Date,
  end: Date,
  timeZone: string,
  previousEnd: Date | null,
): ReportPeriod {
  return {
    kind: "session",
    label: localDay(session, timeZone),
    start: periodStart(end, previousEnd),
    end,
    session,
  };
}

/** The calendar week (Monday to Sunday, local) that contains `at`. */
export function calendarWeek(timeZone: string, at: Date): { label: string; start: Date; end: Date } {
  const monday = addDays(localDay(at, timeZone), -((localParts(at, timeZone).weekday + 6) % 7));
  return {
    label: isoWeek(monday),
    start: dayStart(monday, timeZone),
    end: dayStart(addDays(monday, 7), timeZone),
  };
}

/**
 * The calendar week of `now`, without a session, as far as it has gone:
 * from Monday (or where the previous report ended) to now. Preparing it
 * again later in the week takes it further; nothing after now is claimed.
 */
export function weekPeriod(timeZone: string, now: Date, previousEnd: Date | null): ReportPeriod {
  const week = calendarWeek(timeZone, now);
  return {
    kind: "week",
    label: week.label,
    start: previousEnd && previousEnd > week.start && previousEnd < now ? previousEnd : week.start,
    end: now,
    session: null,
  };
}

function latestOf(reports: readonly KnownReport[]): KnownReport | null {
  let latest: KnownReport | null = null;
  for (const report of reports) if (!latest || report.periodEnd > latest.periodEnd) latest = report;
  return latest;
}

function same(a: Date | null, b: Date | null): boolean {
  return a !== null && b !== null && a.getTime() === b.getTime();
}

/** A draft the scheduler may still rewrite: nobody has touched its words. */
function untouchedDraft(report: KnownReport): boolean {
  return report.status === "draft" && report.editedAt === null;
}

export type ScheduledPlan =
  | { action: "wait"; until: Date | null }
  | { action: "create"; period: ReportPeriod }
  | { action: "retarget"; reportId: string; period: ReportPeriod };

/**
 * What the scheduler does for one person at `now`. It runs every minute
 * and decides from the schedule as it is now, so a session that moves
 * moves the preparation with it, and a restart loses nothing.
 */
export function planScheduledReport(input: {
  schedule: SessionSchedule;
  timeZone: string;
  reports: readonly KnownReport[];
  now: Date;
}): ScheduledPlan {
  const { schedule, timeZone, reports, now } = input;
  const session = upcomingSession(schedule, timeZone, now);
  if (!session) return { action: "wait", until: null };
  const end = preparationTime(schedule, session);
  if (now < end) return { action: "wait", until: end };

  const forSession = reports.find((report) => same(report.sessionAt, session));
  if (forSession) {
    if (forSession.periodEnd >= end || !untouchedDraft(forSession)) return { action: "wait", until: null };
    // Prepared early (by hand): bring it up to the preparation time.
    return {
      action: "retarget",
      reportId: forSession.id,
      period: {
        kind: "session",
        label: localDay(session, timeZone),
        start: forSession.periodStart,
        end,
        session,
      },
    };
  }

  const latest = latestOf(reports);
  // A draft prepared for a session that moved: it follows the session.
  if (
    latest &&
    untouchedDraft(latest) &&
    latest.sessionAt &&
    latest.sessionAt.getTime() > now.getTime() - FIRST_PERIOD_DAYS * DAY &&
    (latest.sessionAt > now || !inSchedule(schedule, timeZone, latest.sessionAt)) &&
    latest.periodStart < end
  ) {
    return {
      action: "retarget",
      reportId: latest.id,
      period: {
        kind: "session",
        label: localDay(session, timeZone),
        start: latest.periodStart,
        end,
        session,
      },
    };
  }
  if (latest && latest.periodEnd >= end) return { action: "wait", until: null };
  return { action: "create", period: sessionPeriod(session, end, timeZone, latest?.periodEnd ?? null) };
}

export type ManualPlan = { action: "create"; period: ReportPeriod } | { action: "open"; reportId: string };

/**
 * "Prepare it now": the report for the next session, covering what exists
 * so far (the scheduler brings an untouched draft up to date later), or
 * the calendar week when no session is set.
 */
export function planReportNow(input: {
  schedule: SessionSchedule;
  timeZone: string;
  reports: readonly KnownReport[];
  now: Date;
}): ManualPlan {
  const { schedule, timeZone, reports, now } = input;
  const latest = latestOf(reports);
  const session = upcomingSession(schedule, timeZone, now);
  if (session) {
    const forSession = reports.find((report) => same(report.sessionAt, session));
    if (forSession) return { action: "open", reportId: forSession.id };
    const prepared = preparationTime(schedule, session);
    const end = prepared < now ? prepared : now;
    const period = sessionPeriod(session, end, timeZone, latest?.periodEnd ?? null);
    if (latest && period.start >= period.end) return { action: "open", reportId: latest.id };
    return { action: "create", period };
  }
  // This week's report, if there is one, is opened (and can be prepared again, further).
  const week = calendarWeek(timeZone, now);
  const thisWeek = reports.find((report) => report.sessionAt === null && report.periodStart >= week.start);
  if (thisWeek) return { action: "open", reportId: thisWeek.id };
  const period = weekPeriod(timeZone, now, latest?.periodEnd ?? null);
  if (latest && period.start >= period.end) return { action: "open", reportId: latest.id };
  return { action: "create", period };
}

/**
 * The period of a report prepared again by hand: the same start, and an
 * end brought up to now (never past the preparation time of its session).
 */
export function periodAgain(
  report: KnownReport,
  schedule: SessionSchedule,
  timeZone: string,
  now: Date,
): ReportPeriod {
  if (!report.sessionAt) {
    const week = calendarWeek(timeZone, report.periodStart);
    const limit = week.end < now ? week.end : now;
    return {
      kind: "week",
      label: week.label,
      start: report.periodStart,
      end: limit > report.periodEnd ? limit : report.periodEnd,
      session: null,
    };
  }
  const prepared = preparationTime(schedule, report.sessionAt);
  const limit = prepared < now ? prepared : now;
  const end = limit > report.periodEnd ? limit : report.periodEnd;
  return {
    kind: "session",
    label: localDay(report.sessionAt, timeZone),
    start: report.periodStart,
    end,
    session: report.sessionAt,
  };
}
