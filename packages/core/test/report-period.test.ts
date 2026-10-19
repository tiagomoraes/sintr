import { describe, expect, it } from "vitest";
import {
  periodAgain,
  periodStart,
  planReportNow,
  planScheduledReport,
  preparationTime,
  upcomingSession,
  weekPeriod,
  type KnownReport,
  type SessionSchedule,
} from "../src/report/period";
import type { SessionChange, SessionSeries } from "../src/report/sessions";
import { zonedTime } from "../src/report/time";

/**
 * The period rules of the agent pack's week_collect.py, on the database:
 * the cases of scripts/test_week_collect.py that still apply (next and
 * last session, an explicit session, the lead across midnight, consecutive
 * periods, the week fallback), plus the scheduler's own decisions, on the
 * therapy calendar: a weekly rhythm, a fortnightly one, two sessions in a
 * week, and sessions moved or cancelled on their own.
 */

const TZ = "America/Recife"; // UTC-3 all year, the pack's fixture zone

function series(partial: Partial<SessionSeries> & Pick<SessionSeries, "startsOn">): SessionSeries {
  return { id: "s1", time: "18:00", repeat: "weekly", weekdays: [], stopsOn: null, ...partial };
}

function schedule(
  list: readonly SessionSeries[],
  changes: readonly SessionChange[] = [],
  reportLeadMinutes = 60,
): SessionSchedule {
  return { series: list, changes, reportLeadMinutes };
}

/** Mondays at 18:00 since 7 September 2026: the weekly slot as the calendar holds it. */
const MONDAY_18 = schedule([series({ startsOn: "2026-09-07" })]);
const NONE = schedule([]);

function at(year: number, month: number, day: number, hour = 0, minute = 0, zone = TZ): Date {
  return zonedTime({ year, month, day, hour, minute }, zone);
}

function report(partial: Partial<KnownReport> & Pick<KnownReport, "periodStart" | "periodEnd">): KnownReport {
  return { id: "r1", status: "draft", sessionAt: null, editedAt: null, ...partial };
}

describe("the session a report is for", () => {
  it("is the first session that has not started", () => {
    const before = at(2026, 10, 19, 17, 5); // Monday, 55 minutes before the session
    expect(upcomingSession(MONDAY_18, TZ, before)).toEqual(at(2026, 10, 19, 18));
    const after = at(2026, 10, 19, 18, 30);
    expect(upcomingSession(MONDAY_18, TZ, after)).toEqual(at(2026, 10, 26, 18));
  });

  it("follows the person's time zone, not the server's", () => {
    // Sunday 23:30 UTC is already Monday 08:30 in Tokyo: the session is that Monday at 18:00 there.
    expect(upcomingSession(MONDAY_18, "Asia/Tokyo", new Date("2026-10-18T23:30:00Z"))).toEqual(
      new Date("2026-10-19T09:00:00Z"),
    );
  });

  it("keeps the wall-clock time across a daylight-saving change", () => {
    // New York leaves daylight saving on 1 November 2026: 18:00 is 22:00 UTC before, 23:00 after.
    expect(upcomingSession(MONDAY_18, "America/New_York", new Date("2026-10-27T12:00:00Z"))).toEqual(
      new Date("2026-11-02T23:00:00Z"),
    );
    expect(upcomingSession(MONDAY_18, "America/New_York", new Date("2026-10-20T12:00:00Z"))).toEqual(
      new Date("2026-10-26T22:00:00Z"),
    );
  });

  it("does not exist without a session in the calendar", () => {
    expect(upcomingSession(NONE, TZ, at(2026, 10, 19))).toBeNull();
    // A single session that already happened leaves nothing to come.
    const once = schedule([series({ startsOn: "2026-10-01", repeat: "once" })]);
    expect(upcomingSession(once, TZ, at(2026, 10, 19))).toBeNull();
  });

  it("is the real next one: a session moved on its own, or cancelled, is where the calendar says", () => {
    const moved = schedule(MONDAY_18.series, [
      { seriesId: "s1", occursOn: "2026-10-19", movedTo: { on: "2026-10-21", time: "09:30" } },
    ]);
    expect(upcomingSession(moved, TZ, at(2026, 10, 18, 12))).toEqual(at(2026, 10, 21, 9, 30));
    const cancelled = schedule(MONDAY_18.series, [{ seriesId: "s1", occursOn: "2026-10-19", movedTo: null }]);
    expect(upcomingSession(cancelled, TZ, at(2026, 10, 18, 12))).toEqual(at(2026, 10, 26, 18));
  });

  it("finds a session fifteen days away, and further after cancelled ones", () => {
    const fifteen = schedule(
      [series({ startsOn: "2026-10-01", repeat: "every_15_days" })],
      [
        { seriesId: "s1", occursOn: "2026-10-16", movedTo: null },
        { seriesId: "s1", occursOn: "2026-10-31", movedTo: null },
      ],
    );
    expect(upcomingSession(fifteen, TZ, at(2026, 10, 2))).toEqual(at(2026, 11, 15, 18));
  });
});

describe("the period a report covers", () => {
  it("ends report_lead before the session, and the first one covers the 7 days before", () => {
    const end = preparationTime(MONDAY_18, at(2026, 10, 19, 18));
    expect(end).toEqual(at(2026, 10, 19, 17));
    expect(periodStart(end, null)).toEqual(at(2026, 10, 12, 17));
  });

  it("puts the lead across midnight on the day before", () => {
    const late = schedule([series({ startsOn: "2026-09-07", time: "00:30" })]);
    const session = upcomingSession(late, TZ, at(2026, 10, 18, 12))!;
    expect(session).toEqual(at(2026, 10, 19, 0, 30));
    expect(preparationTime(late, session)).toEqual(at(2026, 10, 18, 23, 30));
  });

  it("starts where the previous report ended, so consecutive periods meet exactly", () => {
    const first = planScheduledReport({
      schedule: MONDAY_18,
      timeZone: TZ,
      reports: [],
      now: at(2026, 10, 12, 17),
    });
    expect(first.action).toBe("create");
    if (first.action !== "create") return;
    const previous = report({
      periodStart: first.period.start,
      periodEnd: first.period.end,
      sessionAt: first.period.session,
      status: "sent",
    });
    const second = planScheduledReport({
      schedule: MONDAY_18,
      timeZone: TZ,
      reports: [previous],
      now: at(2026, 10, 19, 17),
    });
    expect(second).toMatchObject({
      action: "create",
      period: { start: first.period.end, end: at(2026, 10, 19, 17) },
    });
  });

  it("reaches back at most four weeks after a long pause", () => {
    const end = at(2026, 10, 19, 17);
    expect(periodStart(end, at(2026, 8, 1))).toEqual(at(2026, 9, 21, 17));
    expect(periodStart(end, at(2026, 10, 15, 9))).toEqual(at(2026, 10, 15, 9));
  });

  it("is the calendar week so far, from Monday to now, when no session is set (the week fallback)", () => {
    const week = weekPeriod(TZ, at(2026, 10, 15, 14), null);
    expect(week).toEqual({
      kind: "week",
      label: "2026-W42",
      start: at(2026, 10, 12),
      end: at(2026, 10, 15, 14),
      session: null,
    });
    expect(planReportNow({ schedule: NONE, timeZone: TZ, reports: [], now: at(2026, 10, 15, 14) })).toEqual({
      action: "create",
      period: week,
    });
  });
});

describe("the scheduler's decision", () => {
  const base = { schedule: MONDAY_18, timeZone: TZ };

  it("waits until report_lead before the session, then prepares exactly once", () => {
    expect(planScheduledReport({ ...base, reports: [], now: at(2026, 10, 19, 16, 59) })).toEqual({
      action: "wait",
      until: at(2026, 10, 19, 17),
    });
    const due = planScheduledReport({ ...base, reports: [], now: at(2026, 10, 19, 17) });
    expect(due).toEqual({
      action: "create",
      period: {
        kind: "session",
        label: "2026-10-19",
        start: at(2026, 10, 12, 17),
        end: at(2026, 10, 19, 17),
        session: at(2026, 10, 19, 18),
      },
    });
    const prepared = report({
      periodStart: at(2026, 10, 12, 17),
      periodEnd: at(2026, 10, 19, 17),
      sessionAt: at(2026, 10, 19, 18),
    });
    expect(planScheduledReport({ ...base, reports: [prepared], now: at(2026, 10, 19, 17, 1) })).toEqual({
      action: "wait",
      until: at(2026, 10, 26, 17),
    });
  });

  it("does not prepare for a session that already started (nothing for the past)", () => {
    expect(planScheduledReport({ ...base, reports: [], now: at(2026, 10, 19, 18, 5) })).toMatchObject({
      action: "wait",
      until: at(2026, 10, 26, 17),
    });
  });

  it("brings a draft prepared early by hand up to the preparation time, unless the person changed it", () => {
    const early = report({
      periodStart: at(2026, 10, 12, 17),
      periodEnd: at(2026, 10, 17, 10),
      sessionAt: at(2026, 10, 19, 18),
    });
    expect(planScheduledReport({ ...base, reports: [early], now: at(2026, 10, 19, 17) })).toEqual({
      action: "retarget",
      reportId: "r1",
      period: {
        kind: "session",
        label: "2026-10-19",
        start: at(2026, 10, 12, 17),
        end: at(2026, 10, 19, 17),
        session: at(2026, 10, 19, 18),
      },
    });
    const edited = { ...early, editedAt: at(2026, 10, 18) };
    expect(planScheduledReport({ ...base, reports: [edited], now: at(2026, 10, 19, 17) }).action).toBe(
      "wait",
    );
  });

  it("follows a rhythm that moved: the untouched draft is prepared again for the new day", () => {
    // Prepared for Monday 19 at 17:00; the person then moves their sessions to Wednesdays at 18:00.
    const draft = report({
      periodStart: at(2026, 10, 12, 17),
      periodEnd: at(2026, 10, 19, 17),
      sessionAt: at(2026, 10, 19, 18),
    });
    const wednesdays = schedule([series({ startsOn: "2026-09-09" })]);
    expect(
      planScheduledReport({ schedule: wednesdays, timeZone: TZ, reports: [draft], now: at(2026, 10, 21, 16) })
        .action,
    ).toBe("wait");
    expect(
      planScheduledReport({
        schedule: wednesdays,
        timeZone: TZ,
        reports: [draft],
        now: at(2026, 10, 21, 17),
      }),
    ).toEqual({
      action: "retarget",
      reportId: "r1",
      period: {
        kind: "session",
        label: "2026-10-21",
        start: at(2026, 10, 12, 17),
        end: at(2026, 10, 21, 17),
        session: at(2026, 10, 21, 18),
      },
    });
  });

  it("follows one session moved on its own, and the rhythm goes on after it", () => {
    const moved = schedule(MONDAY_18.series, [
      { seriesId: "s1", occursOn: "2026-10-19", movedTo: { on: "2026-10-21", time: "18:00" } },
    ]);
    const draft = report({
      periodStart: at(2026, 10, 12, 17),
      periodEnd: at(2026, 10, 19, 17),
      sessionAt: at(2026, 10, 19, 18),
    });
    // Prepared on Monday for Monday's session, then that session alone moved to Wednesday.
    expect(
      planScheduledReport({ schedule: moved, timeZone: TZ, reports: [draft], now: at(2026, 10, 21, 17) }),
    ).toMatchObject({
      action: "retarget",
      period: { end: at(2026, 10, 21, 17), session: at(2026, 10, 21, 18) },
    });
    // Moved before anything was prepared: Wednesday's report, then Monday 26 as always, meeting it.
    const wednesday = planScheduledReport({
      schedule: moved,
      timeZone: TZ,
      reports: [],
      now: at(2026, 10, 21, 17),
    });
    expect(wednesday).toMatchObject({ action: "create", period: { session: at(2026, 10, 21, 18) } });
    const kept = report({
      periodStart: at(2026, 10, 14, 17),
      periodEnd: at(2026, 10, 21, 17),
      sessionAt: at(2026, 10, 21, 18),
      status: "sent",
    });
    expect(
      planScheduledReport({ schedule: moved, timeZone: TZ, reports: [kept], now: at(2026, 10, 26, 17) }),
    ).toMatchObject({
      action: "create",
      period: { start: at(2026, 10, 21, 17), session: at(2026, 10, 26, 18) },
    });
  });

  it("lets a cancelled session's days reach the next one, and its untouched draft follows there", () => {
    const cancelled = schedule(MONDAY_18.series, [{ seriesId: "s1", occursOn: "2026-10-19", movedTo: null }]);
    const sent = report({
      periodStart: at(2026, 10, 5, 17),
      periodEnd: at(2026, 10, 12, 17),
      sessionAt: at(2026, 10, 12, 18),
      status: "sent",
    });
    expect(
      planScheduledReport({ schedule: cancelled, timeZone: TZ, reports: [sent], now: at(2026, 10, 19, 17) }),
    ).toEqual({
      action: "wait",
      until: at(2026, 10, 26, 17),
    });
    expect(
      planScheduledReport({ schedule: cancelled, timeZone: TZ, reports: [sent], now: at(2026, 10, 26, 17) }),
    ).toMatchObject({ action: "create", period: { start: at(2026, 10, 12, 17), end: at(2026, 10, 26, 17) } });
    // Prepared for Monday 19, and that session was cancelled afterwards: the draft goes on to Monday 26.
    const draft = report({
      id: "r2",
      periodStart: at(2026, 10, 12, 17),
      periodEnd: at(2026, 10, 19, 17),
      sessionAt: at(2026, 10, 19, 18),
    });
    expect(
      planScheduledReport({
        schedule: cancelled,
        timeZone: TZ,
        reports: [sent, draft],
        now: at(2026, 10, 26, 17),
      }),
    ).toMatchObject({
      action: "retarget",
      reportId: "r2",
      period: { start: at(2026, 10, 12, 17), end: at(2026, 10, 26, 17) },
    });
  });

  it("starts a new report after a session that happened, even if its draft was never approved", () => {
    const old = report({
      periodStart: at(2026, 10, 12, 17),
      periodEnd: at(2026, 10, 19, 17),
      sessionAt: at(2026, 10, 19, 18),
    });
    expect(planScheduledReport({ ...base, reports: [old], now: at(2026, 10, 26, 17) })).toMatchObject({
      action: "create",
      period: { start: at(2026, 10, 19, 17), end: at(2026, 10, 26, 17), session: at(2026, 10, 26, 18) },
    });
  });

  it("gives a session added before a draft's session that draft, and the later one a report of its own", () => {
    // Monday 19's draft was prepared by hand on Friday; then a single session was added on Sunday 18 at 10:00.
    const withSunday = schedule([
      ...MONDAY_18.series,
      series({ id: "s2", startsOn: "2026-10-18", time: "10:00", repeat: "once" }),
    ]);
    const early = report({
      periodStart: at(2026, 10, 9, 10),
      periodEnd: at(2026, 10, 16, 10),
      sessionAt: at(2026, 10, 19, 18),
    });
    expect(
      planScheduledReport({ schedule: withSunday, timeZone: TZ, reports: [early], now: at(2026, 10, 18, 9) }),
    ).toMatchObject({
      action: "retarget",
      reportId: "r1",
      period: { end: at(2026, 10, 18, 9), session: at(2026, 10, 18, 10) },
    });
    const sunday = { ...early, periodEnd: at(2026, 10, 18, 9), sessionAt: at(2026, 10, 18, 10) };
    expect(
      planScheduledReport({
        schedule: withSunday,
        timeZone: TZ,
        reports: [sunday],
        now: at(2026, 10, 19, 17),
      }),
    ).toMatchObject({
      action: "create",
      period: { start: at(2026, 10, 18, 9), session: at(2026, 10, 19, 18) },
    });
  });
});

/**
 * The scheduler as the worker runs it: a tick every quarter of an hour for
 * eight weeks, every plan applied, nobody touching a draft. Each session
 * gets one report, prepared report_lead before it, and the periods meet
 * exactly, one after the other.
 */
function simulate(calendar: SessionSchedule, from: Date, weeks: number) {
  const reports: (KnownReport & { preparedAt: Date })[] = [];
  const end = from.getTime() + weeks * 7 * 24 * 60 * 60_000;
  for (let t = from.getTime(); t <= end; t += 15 * 60_000) {
    const now = new Date(t);
    for (let step = 0; step < 4; step += 1) {
      const plan = planScheduledReport({ schedule: calendar, timeZone: TZ, reports, now });
      if (plan.action === "wait") break;
      if (plan.action === "create") {
        reports.push({
          id: `r${reports.length + 1}`,
          status: "draft",
          editedAt: null,
          sessionAt: plan.period.session,
          periodStart: plan.period.start,
          periodEnd: plan.period.end,
          preparedAt: now,
        });
      } else {
        const found = reports.find((r) => r.id === plan.reportId)!;
        Object.assign(found, {
          sessionAt: plan.period.session,
          periodStart: plan.period.start,
          periodEnd: plan.period.end,
          preparedAt: now,
        });
      }
    }
  }
  return reports.sort((a, b) => a.periodStart.getTime() - b.periodStart.getTime());
}

function expectMeeting(reports: ReturnType<typeof simulate>, lead: number, sessions: Date[]) {
  expect(reports.map((r) => r.sessionAt)).toEqual(sessions);
  for (const [i, r] of reports.entries()) {
    expect(r.periodEnd).toEqual(new Date(r.sessionAt!.getTime() - lead * 60_000));
    expect(r.preparedAt).toEqual(r.periodEnd);
    if (i > 0) expect(r.periodStart).toEqual(reports[i - 1]!.periodEnd);
  }
}

describe("eight weeks of ticks", () => {
  it("a weekly session: one report a week, each meeting the last", () => {
    const reports = simulate(MONDAY_18, at(2026, 10, 5), 8);
    expectMeeting(
      reports,
      60,
      [5, 12, 19, 26].map((d) => at(2026, 10, d, 18)).concat([2, 9, 16, 23].map((d) => at(2026, 11, d, 18))),
    );
  });

  it("a fortnightly session: one report every two weeks, covering both", () => {
    const fortnight = schedule([series({ startsOn: "2026-10-06", repeat: "fortnightly" })]);
    const reports = simulate(fortnight, at(2026, 10, 5), 8);
    expectMeeting(reports, 60, [
      at(2026, 10, 6, 18),
      at(2026, 10, 20, 18),
      at(2026, 11, 3, 18),
      at(2026, 11, 17, 18),
    ]);
    expect(reports[1]!.periodEnd.getTime() - reports[1]!.periodStart.getTime()).toBe(14 * 24 * 60 * 60_000);
  });

  it("two sessions in a week, at different times: two reports a week", () => {
    const twice = schedule([
      series({ id: "tue", startsOn: "2026-10-06", time: "18:00" }),
      series({ id: "thu", startsOn: "2026-10-08", time: "09:00" }),
    ]);
    const reports = simulate(twice, at(2026, 10, 5), 4);
    expectMeeting(
      reports,
      60,
      [6, 8, 13, 15, 20, 22, 27, 29].map((d) => at(2026, 10, d, [6, 13, 20, 27].includes(d) ? 18 : 9)),
    );
  });

  it("two weekdays of one rhythm, with a lead longer than the days between them", () => {
    const close = schedule(
      [series({ startsOn: "2026-10-05", repeat: "weekdays", weekdays: [1, 2] })],
      [],
      2880,
    );
    const reports = simulate(close, at(2026, 10, 1), 3);
    expectMeeting(
      reports,
      2880,
      [5, 6, 12, 13, 19, 20].map((d) => at(2026, 10, d, 18)),
    );
  });

  it("a rhythm with one session moved and one cancelled", () => {
    const changed = schedule(MONDAY_18.series, [
      { seriesId: "s1", occursOn: "2026-10-12", movedTo: { on: "2026-10-14", time: "08:00" } },
      { seriesId: "s1", occursOn: "2026-10-19", movedTo: null },
    ]);
    const reports = simulate(changed, at(2026, 10, 3), 4);
    expectMeeting(reports, 60, [at(2026, 10, 5, 18), at(2026, 10, 14, 8), at(2026, 10, 26, 18)]);
  });
});

describe("prepare it now", () => {
  it("opens this week's report, and preparing it again takes it up to now, never past Sunday", () => {
    const week = report({ id: "w1", periodStart: at(2026, 10, 12), periodEnd: at(2026, 10, 14, 9) });
    expect(
      planReportNow({ schedule: NONE, timeZone: TZ, reports: [week], now: at(2026, 10, 16, 10) }),
    ).toEqual({
      action: "open",
      reportId: "w1",
    });
    expect(periodAgain(week, NONE, TZ, at(2026, 10, 16, 10))).toMatchObject({ end: at(2026, 10, 16, 10) });
    expect(periodAgain(week, NONE, TZ, at(2026, 10, 21, 10))).toMatchObject({ end: at(2026, 10, 19) });
  });

  it("starts next week's report where this week's ended, and a session's report where the week's ended", () => {
    const week = report({
      periodStart: at(2026, 10, 12),
      periodEnd: at(2026, 10, 14, 9),
      status: "reviewed",
    });
    expect(
      planReportNow({ schedule: NONE, timeZone: TZ, reports: [week], now: at(2026, 10, 20, 10) }),
    ).toMatchObject({
      action: "create",
      period: { label: "2026-W43", start: at(2026, 10, 19), end: at(2026, 10, 20, 10) },
    });
    expect(
      planScheduledReport({ schedule: MONDAY_18, timeZone: TZ, reports: [week], now: at(2026, 10, 19, 17) }),
    ).toMatchObject({
      action: "create",
      period: { start: at(2026, 10, 14, 9), end: at(2026, 10, 19, 17) },
    });
  });

  it("covers what exists so far for the next session, and opens it when it exists", () => {
    const plan = planReportNow({ schedule: MONDAY_18, timeZone: TZ, reports: [], now: at(2026, 10, 17, 10) });
    expect(plan).toEqual({
      action: "create",
      period: {
        kind: "session",
        label: "2026-10-19",
        start: at(2026, 10, 10, 10),
        end: at(2026, 10, 17, 10),
        session: at(2026, 10, 19, 18),
      },
    });
    const existing = report({
      id: "r9",
      periodStart: at(2026, 10, 10, 10),
      periodEnd: at(2026, 10, 17, 10),
      sessionAt: at(2026, 10, 19, 18),
    });
    expect(
      planReportNow({ schedule: MONDAY_18, timeZone: TZ, reports: [existing], now: at(2026, 10, 18, 10) }),
    ).toEqual({
      action: "open",
      reportId: "r9",
    });
  });
});
