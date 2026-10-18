import { describe, expect, it } from "vitest";
import { buildDigest, historyStart } from "../src/report/digest";
import { DEMO_PERIOD, DEMO_TZ, demoRecords, local } from "./report-fixtures";

describe("the digest of a period", () => {
  const { entries, checkins } = demoRecords();
  const digest = buildDigest({ period: DEMO_PERIOD, timeZone: DEMO_TZ, entries, checkins });

  it("emits the header the report writer needs: the session, the exact range, the target date", () => {
    expect(digest).toMatchObject({
      kind: "session",
      label: "2026-10-19",
      start: "2026-10-12T20:00:00.000Z",
      end: "2026-10-19T20:00:00.000Z",
      session: "2026-10-19T21:00:00.000Z",
      timeZone: DEMO_TZ,
    });
  });

  it("lists the period's entries only, oldest first, and counts them", () => {
    // The Sunday entry of 11 October belongs to the period before.
    expect(digest.entries.map((e) => e.title)).toEqual([
      "Reunião com quatro pedidos novos",
      "Conversa com a coordenadora",
      "Volta no parque na hora do almoço",
      "Domingo de tarde de novo",
    ]);
    expect(digest.counts).toEqual({ entries: 4, checkins: 6, daysWithCheckin: 6, days: 7 });
  });

  it("keeps the person's words exactly as recorded", () => {
    const talk = digest.entries.find((e) => e.title === "Conversa com a coordenadora")!;
    expect(talk.thoughts).toEqual(["ela acha que eu sou devagar", "eu sempre deixo a desejar"]);
    expect(talk.emotionsAfter).toEqual([
      { name: "ansiedade", intensity: 40 },
      { name: "vergonha", intensity: 25 },
    ]);
    expect(digest.notes.map((n) => [n.day, n.note])).toEqual([
      ["2026-10-13", "acordei moído"],
      ["2026-10-15", "dormi tarde terminando a planilha"],
      ["2026-10-17", "dormi sem despertador"],
      ["2026-10-19", "hoje tem sessão"],
    ]);
  });

  it("shows the days the period covers, the morning of the session day included", () => {
    // 12 October is covered only from 17:00 and holds no record, so it is not a day of this report.
    expect(digest.days.map((d) => d.day)).toEqual([
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
      "2026-10-19",
    ]);
    const wednesday = digest.days[1]!;
    expect(wednesday).toEqual({
      day: "2026-10-14",
      weekday: 3,
      mood: null,
      energy: null,
      anxiety: null,
      sleepHours: null,
      entries: 0,
    });
    expect(digest.days.map((d) => d.entries)).toEqual([1, 0, 1, 1, 0, 1, 0]);
  });

  it("computes the averages over the days with a value, with their number of days and the week before", () => {
    // The week before is 5 Oct 17:00 to 12 Oct 17:00: the check-ins of 6, 7, 8 and 9 October.
    expect(digest.measures.mood).toEqual({ average: 3, days: 6, min: 2, max: 4, previous: 3.25 });
    expect(digest.measures.sleepHours.average).toBeCloseTo(41 / 6, 5);
    expect(digest.measures.anxiety).toMatchObject({ days: 6, min: 1, max: 4 });
    expect(digest.measures.energy.previous).toBe(3);
  });

  it("counts emotions and areas across the period's entries", () => {
    expect(digest.emotions[0]).toEqual({ name: "ansiedade", count: 3, average: (80 + 65 + 50) / 3, max: 80 });
    expect(digest.tags).toEqual([
      { name: "trabalho", count: 3 },
      { name: "saúde", count: 1 },
    ]);
  });

  it("draws the chart over up to three earlier weeks, from the first day with a check-in", () => {
    expect(digest.history[0]!.day).toBe("2026-09-22");
    expect(digest.history.at(-1)!.day).toBe("2026-10-19");
    expect(digest.history.find((d) => d.day === "2026-09-25")).toMatchObject({ mood: null });
    expect(historyStart(DEMO_PERIOD, DEMO_TZ) <= local(9, 22)).toBe(true);
  });

  it("averages several check-ins of one day instead of picking one", () => {
    const extra = [...checkins, { ...checkins.at(-1)!, id: "x", occurredAt: local(10, 19, 12), mood: 4 }];
    const twice = buildDigest({ period: DEMO_PERIOD, timeZone: DEMO_TZ, entries, checkins: extra });
    expect(twice.days.at(-1)!.mood).toBe(3.5);
  });

  it("treats the boundaries exactly: the start is in, the end is out", () => {
    const edge = (at: Date) => ({ ...entries[0]!, id: at.toISOString(), occurredAt: at });
    const bounded = buildDigest({
      period: DEMO_PERIOD,
      timeZone: DEMO_TZ,
      entries: [
        edge(local(10, 12, 16, 59)),
        edge(local(10, 12, 17)),
        edge(local(10, 19, 16, 59)),
        edge(local(10, 19, 17)),
      ],
      checkins: [],
    });
    expect(bounded.entries.map((e) => e.id)).toEqual([
      local(10, 12, 17).toISOString(),
      local(10, 19, 16, 59).toISOString(),
    ]);
    // A partial day with a record is shown.
    expect(bounded.days[0]!.day).toBe("2026-10-12");
  });

  it("is a calm, honest digest for a quiet week: nothing invented", () => {
    const quiet = buildDigest({ period: DEMO_PERIOD, timeZone: DEMO_TZ, entries: [], checkins: [] });
    expect(quiet.counts).toEqual({ entries: 0, checkins: 0, daysWithCheckin: 0, days: 7 });
    expect(quiet.measures.mood).toEqual({ average: null, days: 0, min: null, max: null, previous: null });
    expect(quiet.entries).toEqual([]);
    expect(quiet.notes).toEqual([]);
    expect(quiet.history.map((d) => d.day)).toEqual(quiet.days.map((d) => d.day));
    expect(quiet.days.every((d) => d.mood === null && d.entries === 0)).toBe(true);
  });
});
