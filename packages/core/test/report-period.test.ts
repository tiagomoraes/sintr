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
import { zonedTime } from "../src/report/time";

/**
 * The period rules of the agent pack's week_collect.py, on the database:
 * the cases of scripts/test_week_collect.py that still apply (next and
 * last session, an explicit session, the lead across midnight, consecutive
 * periods, the week fallback), plus the scheduler's own decisions.
 */

const TZ = "America/Recife"; // UTC-3 all year, the pack's fixture zone
const MONDAY_18: SessionSchedule = {
  sessionDay: 1,
  sessionTime: "18:00",
  reportLeadMinutes: 60,
};

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
    const tokyo = { ...MONDAY_18 };
    // Sunday 23:30 UTC is already Monday 08:30 in Tokyo: the session is that Monday at 18:00 there.
    expect(upcomingSession(tokyo, "Asia/Tokyo", new Date("2026-10-18T23:30:00Z"))).toEqual(
      new Date("2026-10-19T09:00:00Z"),
    );
  });

  it("keeps the wall-clock time across a daylight-saving change", () => {
    const ny = { ...MONDAY_18 };
    // New York leaves daylight saving on 1 November 2026: 18:00 is 22:00 UTC before, 23:00 after.
    expect(upcomingSession(ny, "America/New_York", new Date("2026-10-27T12:00:00Z"))).toEqual(
      new Date("2026-11-02T23:00:00Z"),
    );
    expect(upcomingSession(ny, "America/New_York", new Date("2026-10-20T12:00:00Z"))).toEqual(
      new Date("2026-10-26T22:00:00Z"),
    );
  });

  it("does not exist without a day and a time", () => {
    expect(upcomingSession({ ...MONDAY_18, sessionTime: null }, TZ, at(2026, 10, 19))).toBeNull();
    expect(upcomingSession({ ...MONDAY_18, sessionDay: null }, TZ, at(2026, 10, 19))).toBeNull();
  });
});

describe("the period a report covers", () => {
  it("ends report_lead before the session, and the first one covers the 7 days before", () => {
    const end = preparationTime(MONDAY_18, at(2026, 10, 19, 18));
    expect(end).toEqual(at(2026, 10, 19, 17));
    expect(periodStart(end, null)).toEqual(at(2026, 10, 12, 17));
  });

  it("puts the lead across midnight on the day before", () => {
    const late = { ...MONDAY_18, sessionTime: "00:30" };
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
    const none = { sessionDay: null, sessionTime: null, reportLeadMinutes: 60 };
    expect(planReportNow({ schedule: none, timeZone: TZ, reports: [], now: at(2026, 10, 15, 14) })).toEqual({
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
      until: null,
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

  it("follows a session that moved: the untouched draft is prepared again for the new time", () => {
    // Prepared for Monday 19 at 17:00; the person then moves their sessions to Wednesdays at 18:00.
    const draft = report({
      periodStart: at(2026, 10, 12, 17),
      periodEnd: at(2026, 10, 19, 17),
      sessionAt: at(2026, 10, 19, 18),
    });
    const wednesdays = { ...MONDAY_18, sessionDay: 3 };
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
});

describe("prepare it now", () => {
  const none = { sessionDay: null, sessionTime: null, reportLeadMinutes: 60 };

  it("opens this week's report, and preparing it again takes it up to now, never past Sunday", () => {
    const week = report({ id: "w1", periodStart: at(2026, 10, 12), periodEnd: at(2026, 10, 14, 9) });
    expect(
      planReportNow({ schedule: none, timeZone: TZ, reports: [week], now: at(2026, 10, 16, 10) }),
    ).toEqual({
      action: "open",
      reportId: "w1",
    });
    expect(periodAgain(week, none, TZ, at(2026, 10, 16, 10))).toMatchObject({ end: at(2026, 10, 16, 10) });
    expect(periodAgain(week, none, TZ, at(2026, 10, 21, 10))).toMatchObject({ end: at(2026, 10, 19) });
  });

  it("starts next week's report where this week's ended, and a session's report where the week's ended", () => {
    const week = report({
      periodStart: at(2026, 10, 12),
      periodEnd: at(2026, 10, 14, 9),
      status: "reviewed",
    });
    expect(
      planReportNow({ schedule: none, timeZone: TZ, reports: [week], now: at(2026, 10, 20, 10) }),
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
