import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ValidationError } from "../src/errors";
import { createRepositories, type UserScope } from "../src/repositories";
import {
  isSeriesDay,
  normalizeSeries,
  seriesDays,
  sessionsOn,
  type SessionCalendar,
  type SessionSeries,
} from "../src/report/sessions";
import { createUser, openTestDatabase, testMasterKey } from "./support";

/**
 * The therapy calendar: how a rhythm falls on days, how a session moved or
 * cancelled on its own changes only itself, and how changing or stopping a
 * rhythm from one session on leaves the earlier ones as they were.
 */

function series(partial: Partial<SessionSeries> & Pick<SessionSeries, "startsOn">): SessionSeries {
  return { id: "s1", time: "18:00", repeat: "weekly", weekdays: [], stopsOn: null, ...partial };
}

const days = (s: SessionSeries, first = "2026-10-01", last = "2026-11-30") => seriesDays(s, first, last);

describe("a rhythm on the calendar", () => {
  it("falls every week, every two weeks or every fifteen days from its first session", () => {
    expect(days(series({ startsOn: "2026-10-06" }), "2026-10-01", "2026-10-31")).toEqual([
      "2026-10-06",
      "2026-10-13",
      "2026-10-20",
      "2026-10-27",
    ]);
    expect(
      days(series({ startsOn: "2026-09-29", repeat: "fortnightly" }), "2026-10-01", "2026-11-10"),
    ).toEqual(["2026-10-13", "2026-10-27", "2026-11-10"]);
    // Fifteen days is not two weeks: it moves through the days of the week.
    expect(
      days(series({ startsOn: "2026-10-01", repeat: "every_15_days" }), "2026-10-01", "2026-11-30"),
    ).toEqual(["2026-10-01", "2026-10-16", "2026-10-31", "2026-11-15", "2026-11-30"]);
  });

  it("falls on chosen weekdays, and starts on one of them", () => {
    const tuesdayThursday = normalizeSeries(
      series({ startsOn: "2026-10-05", repeat: "weekdays", weekdays: [4, 2, 4] }),
    );
    expect(tuesdayThursday).toMatchObject({ startsOn: "2026-10-06", weekdays: [2, 4] });
    expect(days(tuesdayThursday, "2026-10-01", "2026-10-16")).toEqual([
      "2026-10-06",
      "2026-10-08",
      "2026-10-13",
      "2026-10-15",
    ]);
    // Only a rhythm on chosen weekdays keeps them.
    expect(normalizeSeries(series({ startsOn: "2026-10-05", weekdays: [1] })).weekdays).toEqual([]);
  });

  it("holds one date when it does not repeat, and nothing after it stopped", () => {
    expect(days(series({ startsOn: "2026-10-21", repeat: "once" }))).toEqual(["2026-10-21"]);
    expect(days(series({ startsOn: "2026-10-06", stopsOn: "2026-10-20" }))).toEqual([
      "2026-10-06",
      "2026-10-13",
    ]);
    expect(isSeriesDay(series({ startsOn: "2026-10-06" }), "2026-10-07")).toBe(false);
    expect(isSeriesDay(series({ startsOn: "2026-10-06" }), "2026-09-29")).toBe(false);
  });

  it("shows a moved session where it moved to and a cancelled one marked at its own day", () => {
    const calendar: SessionCalendar = {
      series: [series({ startsOn: "2026-10-06" })],
      changes: [
        { seriesId: "s1", occursOn: "2026-10-13", movedTo: { on: "2026-10-15", time: "09:00" } },
        { seriesId: "s1", occursOn: "2026-10-20", movedTo: null },
        // A change that names no session of its rhythm is not a session.
        { seriesId: "s1", occursOn: "2026-10-14", movedTo: { on: "2026-10-16", time: "09:00" } },
      ],
    };
    const shown = sessionsOn(calendar, "America/Sao_Paulo", "2026-10-01", "2026-10-31").map((s) => [
      s.on,
      s.time,
      s.occursOn,
      s.moved ? "moved" : s.cancelled ? "cancelled" : "",
    ]);
    expect(shown).toEqual([
      ["2026-10-06", "18:00", "2026-10-06", ""],
      ["2026-10-15", "09:00", "2026-10-13", "moved"],
      ["2026-10-20", "18:00", "2026-10-20", "cancelled"],
      ["2026-10-27", "18:00", "2026-10-27", ""],
    ]);
  });

  it("keeps each session's wall-clock time in the person's zone, across a daylight-saving change", () => {
    const calendar: SessionCalendar = { series: [series({ startsOn: "2026-10-26" })], changes: [] };
    const [before, after] = sessionsOn(calendar, "America/New_York", "2026-10-26", "2026-11-02");
    expect(before!.at).toEqual(new Date("2026-10-26T22:00:00Z"));
    expect(after!.at).toEqual(new Date("2026-11-02T23:00:00Z"));
  });
});

describe("the calendar, kept for one person", () => {
  const handle = openTestDatabase();
  const repositories = createRepositories(handle.db, testMasterKey);
  let scope: UserScope;

  beforeAll(async () => {
    const id = await createUser(handle.db, "calendar");
    await repositories.provision(id);
    scope = await repositories.forUser(id);
  });
  afterAll(() => handle.close());

  async function reset() {
    await handle.db.execute(sql`delete from therapy_series where user_id = ${scope.userId}`);
  }

  it("adds a session that repeats, and one that does not", async () => {
    await reset();
    const weekly = await scope.sessions.add({ startsOn: "2026-10-06", time: "18:00", repeat: "weekly" });
    const once = await scope.sessions.add({ startsOn: "2026-10-09", time: "08:30", repeat: "once" });
    expect(await scope.sessions.calendar()).toEqual({
      series: [
        {
          id: weekly.id,
          startsOn: "2026-10-06",
          time: "18:00",
          repeat: "weekly",
          weekdays: [],
          stopsOn: null,
        },
        { id: once.id, startsOn: "2026-10-09", time: "08:30", repeat: "once", weekdays: [], stopsOn: null },
      ],
      changes: [],
    });
    expect((await scope.sessions.schedule()).reportLeadMinutes).toBe(60);
  });

  it("refuses what is not a day, a time and a rhythm, and has no place for words", async () => {
    await expect(
      scope.sessions.add({ startsOn: "2026-02-30", time: "18:00", repeat: "weekly" }),
    ).rejects.toThrow(ValidationError);
    await expect(
      scope.sessions.add({ startsOn: "2026-10-06", time: "7pm", repeat: "weekly" }),
    ).rejects.toThrow(ValidationError);
    await expect(
      scope.sessions.add({ startsOn: "2026-10-06", time: "18:00", repeat: "weekdays", weekdays: [] }),
    ).rejects.toThrow(ValidationError);
    await expect(
      scope.sessions.add({ startsOn: "2026-10-06", time: "18:00", repeat: "weekly", weekdays: [2] }),
    ).rejects.toThrow(ValidationError);
    // Days, times, how it repeats and ids: no column a word could be written into, sealed or not.
    const columns = await handle.db.execute<{ column_name: string; data_type: string }>(
      sql`select column_name, data_type from information_schema.columns
          where table_name in ('therapy_series', 'therapy_series_changes') and column_name <> 'user_id'`,
    );
    expect([...new Set(columns.map((c) => c.data_type))].sort()).toEqual([
      "ARRAY",
      "USER-DEFINED",
      "date",
      "time without time zone",
      "timestamp with time zone",
      "uuid",
    ]);
  });

  it("moves or cancels one session of a rhythm and leaves the others where they are", async () => {
    await reset();
    const weekly = await scope.sessions.add({ startsOn: "2026-10-06", time: "18:00", repeat: "weekly" });
    expect(
      await scope.sessions.move(
        { seriesId: weekly.id, occursOn: "2026-10-13" },
        { on: "2026-10-15", time: "09:00" },
      ),
    ).toBe(true);
    expect(await scope.sessions.cancel({ seriesId: weekly.id, occursOn: "2026-10-20" })).toBe(true);
    // Not a session of this rhythm: nothing to move.
    expect(
      await scope.sessions.move(
        { seriesId: weekly.id, occursOn: "2026-10-14" },
        { on: "2026-10-15", time: "09:00" },
      ),
    ).toBe(false);
    const calendar = await scope.sessions.calendar();
    expect(calendar.series).toEqual([
      expect.objectContaining({ id: weekly.id, startsOn: "2026-10-06", stopsOn: null }),
    ]);
    expect(
      sessionsOn(calendar, "UTC", "2026-10-01", "2026-10-31").map(
        (s) => `${s.on} ${s.time}${s.cancelled ? " cancelled" : ""}`,
      ),
    ).toEqual(["2026-10-06 18:00", "2026-10-15 09:00", "2026-10-20 18:00 cancelled", "2026-10-27 18:00"]);
    // Moved again, the same session moves; put back, it is the rhythm's again.
    await scope.sessions.move(
      { seriesId: weekly.id, occursOn: "2026-10-13" },
      { on: "2026-10-16", time: "10:00" },
    );
    expect((await scope.sessions.calendar()).changes).toHaveLength(2);
    await scope.sessions.move(
      { seriesId: weekly.id, occursOn: "2026-10-13" },
      { on: "2026-10-13", time: "18:00" },
    );
    expect(await scope.sessions.restore({ seriesId: weekly.id, occursOn: "2026-10-20" })).toBe(true);
    expect((await scope.sessions.calendar()).changes).toEqual([]);
  });

  it("moves a session that does not repeat, and cancelling it removes it", async () => {
    await reset();
    const once = await scope.sessions.add({ startsOn: "2026-10-09", time: "08:30", repeat: "once" });
    await scope.sessions.move(
      { seriesId: once.id, occursOn: "2026-10-09" },
      { on: "2026-10-10", time: "11:00" },
    );
    expect((await scope.sessions.calendar()).series).toEqual([
      expect.objectContaining({ startsOn: "2026-10-10", time: "11:00" }),
    ]);
    await scope.sessions.cancel({ seriesId: once.id, occursOn: "2026-10-10" });
    expect(await scope.sessions.calendar()).toEqual({ series: [], changes: [] });
  });

  it("changes a rhythm from one session on, keeping the earlier sessions as they were", async () => {
    await reset();
    const weekly = await scope.sessions.add({ startsOn: "2026-10-06", time: "18:00", repeat: "weekly" });
    await scope.sessions.move(
      { seriesId: weekly.id, occursOn: "2026-10-13" },
      { on: "2026-10-14", time: "18:00" },
    );
    await scope.sessions.cancel({ seriesId: weekly.id, occursOn: "2026-10-27" });
    // From 20 October on: every two weeks on Thursday at 09:00.
    const next = await scope.sessions.changeFrom(
      { seriesId: weekly.id, occursOn: "2026-10-20" },
      { startsOn: "2026-10-22", time: "09:00", repeat: "fortnightly" },
    );
    const calendar = await scope.sessions.calendar();
    expect(calendar.series).toEqual([
      expect.objectContaining({ id: weekly.id, stopsOn: "2026-10-20" }),
      expect.objectContaining({ id: next!.id, startsOn: "2026-10-22", time: "09:00", repeat: "fortnightly" }),
    ]);
    // The move before the change stays; the cancellation after it belonged to the old rhythm.
    expect(calendar.changes).toEqual([expect.objectContaining({ occursOn: "2026-10-13" })]);
    expect(sessionsOn(calendar, "UTC", "2026-10-01", "2026-11-30").map((s) => `${s.on} ${s.time}`)).toEqual([
      "2026-10-06 18:00",
      "2026-10-14 18:00",
      "2026-10-22 09:00",
      "2026-11-05 09:00",
      "2026-11-19 09:00",
    ]);
  });

  it("changes the whole rhythm from its first session, and stops it from one session on", async () => {
    await reset();
    const weekly = await scope.sessions.add({ startsOn: "2026-10-06", time: "18:00", repeat: "weekly" });
    await scope.sessions.changeFrom(
      { seriesId: weekly.id, occursOn: "2026-10-06" },
      { startsOn: "2026-10-06", time: "19:00", repeat: "weekly" },
    );
    expect((await scope.sessions.calendar()).series).toEqual([
      expect.objectContaining({ id: weekly.id, time: "19:00", stopsOn: null }),
    ]);
    expect(await scope.sessions.stopFrom({ seriesId: weekly.id, occursOn: "2026-10-27" })).toBe(true);
    expect(seriesDays((await scope.sessions.calendar()).series[0]!, "2026-10-01", "2026-12-31")).toEqual([
      "2026-10-06",
      "2026-10-13",
      "2026-10-20",
    ]);
    expect(await scope.sessions.stopFrom({ seriesId: weekly.id, occursOn: "2026-10-06" })).toBe(true);
    expect((await scope.sessions.calendar()).series).toEqual([]);
  });

  it("says every Tuesday at 18:00 in one move, and changes that one rhythm without erasing anything", async () => {
    await reset();
    await scope.sessions.setWeekly(2, "18:00", "2026-10-19");
    expect((await scope.sessions.calendar()).series).toEqual([
      expect.objectContaining({ startsOn: "2026-10-20", time: "18:00", repeat: "weekly" }),
    ]);
    // Said again: nothing changes.
    await scope.sessions.setWeekly(2, "18:00", "2026-10-26");
    expect((await scope.sessions.calendar()).series).toHaveLength(1);
    // Later, Wednesdays: the Tuesdays before stay, the Wednesdays begin.
    await scope.sessions.setWeekly(3, "18:00", "2026-11-02");
    const calendar = await scope.sessions.calendar();
    expect(sessionsOn(calendar, "UTC", "2026-10-19", "2026-11-12").map((s) => s.on)).toEqual([
      "2026-10-20",
      "2026-10-27",
      "2026-11-04",
      "2026-11-11",
    ]);
    // Next to a second rhythm, it is added and nothing is replaced.
    await scope.sessions.add({ startsOn: "2026-11-06", time: "08:00", repeat: "weekly" });
    await scope.sessions.setWeekly(1, "07:00", "2026-11-02");
    expect((await scope.sessions.calendar()).series).toHaveLength(4);
  });
});
