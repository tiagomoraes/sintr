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
 * - The sessions are the person's calendar (`./sessions`): one date, or a
 *   rhythm, with any session of it moved or cancelled on its own. Two
 *   sessions in a week are two reports. A session that moved moves the
 *   preparation with it, because the calendar says where it is now, never
 *   because a date looked near it (DECISIONS 111 and 125).
 */
import type { ReportStatus } from "../domain";
import { heldSessions, type SessionCalendar } from "./sessions";
import { addDays, dayStart, isoWeek, localDay, localParts } from "./time";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
export const FIRST_PERIOD_DAYS = 7;
export const MAX_PERIOD_DAYS = 28;
/** How far ahead the next session is looked for: first a few weeks, then a little over a year. */
const NEAR_DAYS = 42;
const HORIZON_DAYS = 400;

export interface SessionSchedule extends SessionCalendar {
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

/** The moments of the sessions that will be held after `now`, in order, within `days`. */
export function upcomingSessions(
  schedule: SessionSchedule,
  timeZone: string,
  now: Date,
  days: number = NEAR_DAYS,
): Date[] {
  return heldSessions(
    schedule,
    timeZone,
    new Date(now.getTime() + 1),
    new Date(now.getTime() + days * DAY),
  ).map((session) => session.at);
}

/**
 * The first session that has not started yet, or null when none is set:
 * looked for in the next few weeks, and then as far as a year ahead, so a
 * rhythm of fifteen days with a few sessions cancelled is still found.
 */
export function upcomingSession(schedule: SessionSchedule, timeZone: string, now: Date): Date | null {
  return (
    upcomingSessions(schedule, timeZone, now)[0] ??
    upcomingSessions(schedule, timeZone, now, HORIZON_DAYS)[0] ??
    null
  );
}

/** Is `at` one of the sessions the calendar holds now (not moved away, not cancelled)? */
export function inSchedule(schedule: SessionSchedule, timeZone: string, at: Date): boolean {
  return heldSessions(
    schedule,
    timeZone,
    new Date(at.getTime() - MINUTE),
    new Date(at.getTime() + MINUTE),
  ).some((session) => session.at.getTime() === at.getTime());
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
 * and decides from the calendar as it is now, so a session that moves
 * moves the preparation with it, and a restart loses nothing. It walks the
 * sessions still to come in order: each whose preparation time has come
 * gets its report once, so two sessions in a week, or a lead longer than
 * the days between two sessions, still give periods that meet exactly.
 */
export function planScheduledReport(input: {
  schedule: SessionSchedule;
  timeZone: string;
  reports: readonly KnownReport[];
  now: Date;
}): ScheduledPlan {
  const { schedule, timeZone, reports, now } = input;
  const latest = latestOf(reports);
  // Every session whose preparation can have come is within the lead (a week at most) and a few weeks.
  const near = upcomingSessions(schedule, timeZone, now);
  if (near.length === 0) {
    const later = upcomingSession(schedule, timeZone, now);
    return { action: "wait", until: later ? preparationTime(schedule, later) : null };
  }
  for (const session of near) {
    const end = preparationTime(schedule, session);
    if (now < end) return { action: "wait", until: end };
    const period = (start: Date): ReportPeriod => ({
      kind: "session",
      label: localDay(session, timeZone),
      start,
      end,
      session,
    });

    const forSession = reports.find((report) => same(report.sessionAt, session));
    if (forSession) {
      // Prepared early (by hand): brought up to the preparation time, unless a later report already began.
      if (forSession === latest && untouchedDraft(forSession) && forSession.periodEnd < end) {
        return { action: "retarget", reportId: forSession.id, period: period(forSession.periodStart) };
      }
      continue;
    }

    // A draft prepared for a session that moved, was cancelled, or now comes after this one: it follows.
    if (
      latest &&
      untouchedDraft(latest) &&
      latest.sessionAt &&
      latest.sessionAt.getTime() > now.getTime() - FIRST_PERIOD_DAYS * DAY &&
      (latest.sessionAt > session || !inSchedule(schedule, timeZone, latest.sessionAt)) &&
      latest.periodStart < end
    ) {
      return { action: "retarget", reportId: latest.id, period: period(latest.periodStart) };
    }
    // Everything up to this preparation is already covered: nothing to prepare for this session.
    if (latest && latest.periodEnd >= end) continue;
    return { action: "create", period: sessionPeriod(session, end, timeZone, latest?.periodEnd ?? null) };
  }
  return { action: "wait", until: null };
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
