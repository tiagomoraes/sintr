import { describe, expect, it } from "vitest";
import { checkinFromForm, entryFromForm, isEmptyCheckin } from "@/lib/forms";
import { catalog } from "@/messages/en";

const ENTRY = catalog.entry.problems;
const CHECKIN = catalog.checkin.problems;

/** The fields a parse refused, or none. */
function refused(parsed: { ok: true } | { ok: false; problems: Record<string, string> }): string[] {
  return parsed.ok ? [] : Object.keys(parsed.problems);
}

function form(entries: [string, string][]): FormData {
  const data = new FormData();
  for (const [name, value] of entries) data.append(name, value);
  return data;
}

describe("the entry form", () => {
  it("keeps the person's words as typed and turns empty fields into nothing", () => {
    const parsed = entryFromForm(
      form([
        ["situation", "  a reunião de segunda  "],
        ["thought", "eu sempre estrago tudo..."],
        ["thought", "   "],
        ["emotionName", "angústia"],
        ["emotionIntensity", "80"],
        ["emotionName", ""],
        ["emotionIntensity", ""],
        ["body", ""],
        ["tags", "work, family , "],
        ["correctionNote", "a intensidade era menor"],
      ]),
      "America/Sao_Paulo",
      ENTRY,
    );
    expect(parsed).toMatchObject({
      ok: true,
      note: "a intensidade era menor",
      values: {
        situation: "  a reunião de segunda  ",
        thoughts: ["eu sempre estrago tudo..."],
        emotions: [{ name: "angústia", intensity: 80 }],
        body: null,
        tags: ["work", "family"],
        alternativeBelief: null,
      },
    });
  });

  it("reads line breaks the same whatever the browser sent, so unchanged words stay unchanged", () => {
    const parsed = entryFromForm(form([["situation", "first line\r\nsecond line"]]), "UTC", ENTRY);
    expect(parsed.ok && parsed.values.situation).toBe("first line\nsecond line");
  });

  it("keeps an emotion without a number, and refuses a number off the scale or without a name", () => {
    expect(
      entryFromForm(
        form([
          ["emotionName", "raiva"],
          ["emotionIntensity", ""],
        ]),
        "UTC",
        ENTRY,
      ),
    ).toMatchObject({
      ok: true,
      values: { emotions: [{ name: "raiva", intensity: null }] },
    });
    expect(
      refused(
        entryFromForm(
          form([
            ["emotionName", "raiva"],
            ["emotionIntensity", "140"],
          ]),
          "UTC",
          ENTRY,
        ),
      ),
    ).toEqual(["emotions"]);
    expect(
      refused(
        entryFromForm(
          form([
            ["emotionName", ""],
            ["emotionIntensity", "40"],
          ]),
          "UTC",
          ENTRY,
        ),
      ),
    ).toEqual(["emotions"]);
  });

  it("reads the time in the person's zone, and leaves an unchanged time out", () => {
    const moved = entryFromForm(form([["occurredAt", "2026-10-18T14:30"]]), "America/Sao_Paulo", ENTRY);
    expect(moved.ok && moved.values.occurredAt).toEqual(new Date("2026-10-18T17:30:00Z"));
    const same = entryFromForm(
      form([
        ["occurredAt", "2026-10-18T14:30"],
        ["occurredAtShown", "2026-10-18T14:30"],
      ]),
      "America/Sao_Paulo",
      ENTRY,
    );
    expect(same.ok && "occurredAt" in same.values).toBe(false);
    expect(entryFromForm(form([["occurredAt", "yesterday"]]), "UTC", ENTRY)).toMatchObject({ ok: false });
  });
});

describe("the check-in form", () => {
  it("takes only what was given, with a comma for decimals", () => {
    const parsed = checkinFromForm(
      form([
        ["mood", "4"],
        ["energy", "none"],
        ["sleepHours", "7,5"],
        ["note", "um dia mais calmo"],
      ]),
      "UTC",
      CHECKIN,
    );
    expect(parsed).toMatchObject({
      ok: true,
      values: {
        mood: 4,
        energy: null,
        anxiety: null,
        sleepHours: 7.5,
        sleepQuality: null,
        note: "um dia mais calmo",
      },
    });
  });

  it("refuses values off the scale", () => {
    expect(refused(checkinFromForm(form([["mood", "6"]]), "UTC", CHECKIN))).toEqual(["mood"]);
    expect(refused(checkinFromForm(form([["sleepHours", "30"]]), "UTC", CHECKIN))).toEqual(["sleepHours"]);
    // The problem is said in the words the page gives it.
    expect(checkinFromForm(form([["mood", "6"]]), "UTC", CHECKIN)).toMatchObject({
      ok: false,
      problems: { mood: "Choose a value from 0 to 5." },
    });
  });

  it("knows an empty check-in", () => {
    const parsed = checkinFromForm(form([["mood", "none"]]), "UTC", CHECKIN);
    expect(parsed.ok && isEmptyCheckin(parsed.values)).toBe(true);
  });
});
