import type { CheckinInput, EntryInput } from "@sintr/core";
import { fromLocalInput } from "./time";

/**
 * Reading the entry and check-in forms. The person's words are kept as
 * typed; an empty field means "nothing here" (null), never a guess. Shared
 * by the server actions and the draft card in the conversation.
 */

export type FormProblems = Record<string, string>;
export type Parsed<T> = { ok: true; values: T; note: string | null } | { ok: false; problems: FormProblems };

type Source = Pick<FormData, "get" | "getAll">;

/**
 * Line endings only: a form posted as multipart turns a textarea's line
 * breaks into CRLF, which would make unchanged words look corrected.
 */
function lines(value: string): string {
  return value.replace(/\r\n?/gu, "\n");
}

function raw(form: Source, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? lines(value) : "";
}

function words(form: Source, name: string): string | null {
  const value = raw(form, name);
  return value.trim().length > 0 ? value : null;
}

function all(form: Source, name: string): string[] {
  return form.getAll(name).map((value) => (typeof value === "string" ? lines(value) : ""));
}

function score(value: string, max: number): number | null | "invalid" {
  const trimmed = value.trim();
  if (trimmed === "" || trimmed === "none") return null;
  if (!/^\d{1,3}$/.test(trimmed)) return "invalid";
  const n = Number(trimmed);
  return n <= max ? n : "invalid";
}

function emotionsFrom(
  form: Source,
  names: string,
  intensities: string,
  field: string,
  problems: FormProblems,
) {
  const nameValues = all(form, names);
  const intensityValues = all(form, intensities);
  const emotions: { name: string; intensity: number | null }[] = [];
  nameValues.forEach((name, index) => {
    const raw = intensityValues[index] ?? "";
    const intensity = score(raw, 100);
    if (name.trim() === "") {
      if (raw.trim() !== "") problems[field] = "Name each emotion, in your own word.";
      return;
    }
    if (intensity === "invalid") {
      problems[field] = "Use a whole number from 0 to 100, or leave it empty.";
      return;
    }
    emotions.push({ name, intensity });
  });
  return emotions.length > 0 ? emotions : null;
}

/**
 * The moment, if the person changed it. The field holds minutes only, so a
 * value equal to what the form showed (`occurredAtShown`) means "unchanged",
 * not "moved to the start of that minute".
 */
function occurredAt(form: Source, timezone: string, problems: FormProblems): Date | undefined {
  const value = form.get("occurredAt");
  if (typeof value !== "string" || value.trim() === "") return undefined;
  if (value === form.get("occurredAtShown")) return undefined;
  const date = fromLocalInput(value, timezone);
  if (!date) problems.occurredAt = "Check the date and time.";
  return date ?? undefined;
}

function correctionNote(form: Source): string | null {
  return words(form, "correctionNote");
}

export function entryFromForm(form: Source, timezone: string): Parsed<EntryInput> {
  const problems: FormProblems = {};
  const thoughts = all(form, "thought").filter((t) => t.trim().length > 0);
  const tags = (words(form, "tags") ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
  const belief = score(raw(form, "alternativeBelief"), 100);
  if (belief === "invalid")
    problems.alternativeBelief = "Use a whole number from 0 to 100, or leave it empty.";
  const when = occurredAt(form, timezone, problems);
  const values: EntryInput = {
    ...(when ? { occurredAt: when } : {}),
    title: words(form, "title"),
    situation: words(form, "situation"),
    thoughts: thoughts.length > 0 ? thoughts : null,
    emotions: emotionsFrom(form, "emotionName", "emotionIntensity", "emotions", problems),
    body: words(form, "body"),
    behavior: words(form, "behavior"),
    context: words(form, "context"),
    tags: tags.length > 0 ? tags : null,
    notes: words(form, "notes"),
    hotThought: words(form, "hotThought"),
    evidenceFor: words(form, "evidenceFor"),
    evidenceAgainst: words(form, "evidenceAgainst"),
    alternative: words(form, "alternative"),
    alternativeBelief: belief === "invalid" ? null : belief,
    emotionsAfter: emotionsFrom(form, "afterName", "afterIntensity", "emotionsAfter", problems),
  };
  if (Object.keys(problems).length > 0) return { ok: false, problems };
  return { ok: true, values, note: correctionNote(form) };
}

export function checkinFromForm(form: Source, timezone: string): Parsed<CheckinInput> {
  const problems: FormProblems = {};
  const scale = (name: "mood" | "energy" | "anxiety") => {
    const value = score(raw(form, name), 5);
    if (value === "invalid") problems[name] = "Choose a value from 0 to 5.";
    return value === "invalid" ? null : value;
  };
  const sleepRaw = (words(form, "sleepHours") ?? "").trim().replace(",", ".");
  let sleepHours: number | null = null;
  if (sleepRaw !== "") {
    const n = Number(sleepRaw);
    if (!Number.isFinite(n) || n < 0 || n > 24) problems.sleepHours = "Use a number of hours from 0 to 24.";
    else sleepHours = Math.round(n * 10) / 10;
  }
  const when = occurredAt(form, timezone, problems);
  const values: CheckinInput = {
    ...(when ? { occurredAt: when } : {}),
    mood: scale("mood"),
    energy: scale("energy"),
    anxiety: scale("anxiety"),
    sleepHours,
    sleepQuality: words(form, "sleepQuality"),
    note: words(form, "note"),
  };
  if (Object.keys(problems).length > 0) return { ok: false, problems };
  return { ok: true, values, note: correctionNote(form) };
}

/** True when a check-in holds nothing at all. */
export function isEmptyCheckin(values: CheckinInput): boolean {
  return [
    values.mood,
    values.energy,
    values.anxiety,
    values.sleepHours,
    values.sleepQuality,
    values.note,
  ].every((v) => v === null || v === undefined);
}
