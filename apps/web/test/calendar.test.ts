import { describe, expect, it } from "vitest";
import {
  addMonths,
  calendarHref,
  calendarState,
  isDay,
  monthWeeks,
  parseSessionKey,
  sessionKey,
  weekStartOf,
} from "@/lib/calendar";
import { formatDate, formatMonth } from "@/lib/format";

const params = (query: string) => new URLSearchParams(query);
const SERIES = "0c151f12-7604-48e8-a5bc-8395b24fc1f3";

describe("the month grid", () => {
  it("shows whole weeks, from the week of the first day to the week of the last", () => {
    // October 2026 begins on a Thursday and ends on a Saturday.
    const monday = monthWeeks("2026-10", 1);
    expect(monday).toHaveLength(5);
    expect(monday[0]![0]).toBe("2026-09-28");
    expect(monday.at(-1)!.at(-1)).toBe("2026-11-01");
    const sunday = monthWeeks("2026-10", 0);
    expect(sunday[0]![0]).toBe("2026-09-27");
    expect(sunday.at(-1)!.at(-1)).toBe("2026-10-31");
    // February 2026 begins on a Sunday and has 28 days: four weeks from Sunday, five from Monday.
    expect(monthWeeks("2026-02", 0)).toHaveLength(4);
    expect(monthWeeks("2026-02", 1)).toHaveLength(5);
  });

  it("starts the week where the page's language starts it", () => {
    expect(weekStartOf("en-GB")).toBe(1);
    expect(weekStartOf("pt-BR")).toBe(0);
    expect(weekStartOf("not a language")).toBe(1);
  });

  it("moves by months across the year", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-10", 12)).toBe("2027-10");
  });

  it("names months and days in the page's language, whatever the zone of the machine", () => {
    expect(formatMonth("2026-10", "en")).toBe("October 2026");
    expect(formatMonth("2026-10", "pt-BR")).toBe("outubro de 2026");
    expect(formatDate("2026-10-20", "en")).toBe("Tuesday 20 October");
    expect(formatDate("2026-10-20", "pt-BR")).toBe("terça-feira, 20 de outubro");
  });
});

describe("the calendar's address", () => {
  it("holds the month, the day, the session and what is being done with it", () => {
    const key = sessionKey(SERIES, "2026-10-27");
    const state = calendarState(
      params(`month=2026-11&day=2026-11-10&session=${key}&do=change`),
      "2026-10-19",
    );
    expect(state).toEqual({ month: "2026-11", day: "2026-11-10", session: key, doing: "change", add: null });
    expect(calendarHref(state)).toBe(`/therapy?month=2026-11&day=2026-11-10&session=${key}&do=change`);
    expect(calendarHref({ month: "2026-10" })).toBe("/therapy?month=2026-10");
  });

  it("falls back to today's month, and keeps nothing it cannot read", () => {
    expect(
      calendarState(params("month=2026-13&day=2026-02-30&session=x&do=delete&add=soon"), "2026-10-19"),
    ).toEqual({
      month: "2026-10",
      day: null,
      session: null,
      doing: null,
      add: null,
    });
    expect(calendarState(params("day=2026-12-03"), "2026-10-19").month).toBe("2026-12");
    expect(isDay("2026-02-29")).toBe(false);
    expect(isDay("2028-02-29")).toBe(true);
  });

  it("names a session by its series and its own day, and nothing else", () => {
    expect(parseSessionKey(sessionKey(SERIES, "2026-10-27"))).toEqual({
      seriesId: SERIES,
      occursOn: "2026-10-27",
    });
    expect(parseSessionKey(`${SERIES}.2026-10-32`)).toBeNull();
    expect(parseSessionKey("2026-10-27")).toBeNull();
    expect(parseSessionKey(null)).toBeNull();
  });
});
