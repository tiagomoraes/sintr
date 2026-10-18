/**
 * The "never invent" rules, applied to every draft before it is stored,
 * whatever the model wrote:
 * - thoughts, the hot thought, the alternative thought and emotion names
 *   must be the person's own words; the stored value is their exact span;
 * - every number (intensities, believability, check-in scales, sleep) must
 *   be a number the person wrote.
 * A draft that breaks a rule is refused with a short reason the model can
 * act on, and nothing is stored.
 */
import { momentIn } from "./moments";
import type { CheckinDraft, EntryDraft } from "./shapes";
import { findVerbatim, wasStated } from "./words";

export interface CheckOptions {
  /** The person's time zone, for a time written without an offset. */
  timezone: string;
}

function moment(value: string | undefined, options: CheckOptions, problems: string[]): string | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const instant = momentIn(value, options.timezone);
  if (!instant) {
    problems.push(
      "occurredAt needs a date and a time; if the person only said the day, leave it out and keep the day in the situation",
    );
  }
  return instant ?? undefined;
}

export type Checked<D> = { ok: true; draft: D } | { ok: false; problems: string[] };

function emotionsChecked(
  label: string,
  emotions: EntryDraft["emotions"],
  personTexts: readonly string[],
  problems: string[],
): EntryDraft["emotions"] {
  if (!emotions) return undefined;
  return emotions.map((emotion, index) => {
    const name = findVerbatim(personTexts, emotion.name);
    if (!name) {
      problems.push(
        `${label}[${index}].name is not a word the person used: use their own word for the emotion, or ask them`,
      );
    }
    if (emotion.intensity !== undefined && !wasStated(personTexts, emotion.intensity)) {
      problems.push(
        `${label}[${index}].intensity ${emotion.intensity} was never said by the person: leave it out and ask for it`,
      );
    }
    return { ...emotion, name: name ?? emotion.name };
  });
}

function verbatim(
  label: string,
  value: string | undefined,
  personTexts: readonly string[],
  problems: string[],
): string | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const found = findVerbatim(personTexts, value);
  if (!found) problems.push(`${label} is not in the person's words: copy it exactly as they wrote it`);
  return found ?? value;
}

function stated(
  label: string,
  value: number | undefined,
  personTexts: readonly string[],
  problems: string[],
) {
  if (value !== undefined && !wasStated(personTexts, value)) {
    problems.push(`${label} ${value} was never said by the person: leave it out and ask for it`);
  }
}

export function checkEntryDraft(
  draft: EntryDraft,
  personTexts: readonly string[],
  options: CheckOptions,
): Checked<EntryDraft> {
  const problems: string[] = [];
  const thoughts = draft.thoughts
    ?.filter((thought) => thought.trim() !== "")
    .map((thought, index) => verbatim(`thoughts[${index}]`, thought, personTexts, problems)!);
  const checked: EntryDraft = {
    ...draft,
    ...(thoughts ? { thoughts } : {}),
    emotions: emotionsChecked("emotions", draft.emotions, personTexts, problems),
    emotionsAfter: emotionsChecked("emotionsAfter", draft.emotionsAfter, personTexts, problems),
    hotThought: verbatim("hotThought", draft.hotThought, personTexts, problems),
    alternative: verbatim("alternative", draft.alternative, personTexts, problems),
    occurredAt: moment(draft.occurredAt, options, problems),
  };
  stated("alternativeBelief", draft.alternativeBelief, personTexts, problems);
  const said = [checked.situation, checked.notes, checked.title].some((v) => v && v.trim() !== "");
  if (!said && !checked.thoughts?.length && !checked.emotions?.length) {
    problems.push("the draft is empty: record at least the situation, a thought, an emotion or a note");
  }
  for (const key of Object.keys(checked) as (keyof EntryDraft)[]) {
    if (checked[key] === undefined) delete checked[key];
  }
  return problems.length ? { ok: false, problems } : { ok: true, draft: checked };
}

export function checkCheckinDraft(
  draft: CheckinDraft,
  personTexts: readonly string[],
  options: CheckOptions,
): Checked<CheckinDraft> {
  const problems: string[] = [];
  const occurredAt = moment(draft.occurredAt, options, problems);
  stated("mood", draft.mood, personTexts, problems);
  stated("energy", draft.energy, personTexts, problems);
  stated("anxiety", draft.anxiety, personTexts, problems);
  stated("sleepHours", draft.sleepHours, personTexts, problems);
  const values = [draft.mood, draft.energy, draft.anxiety, draft.sleepHours, draft.sleepQuality, draft.note];
  if (values.every((v) => v === undefined || (typeof v === "string" && v.trim() === ""))) {
    problems.push("the check-in is empty: record only what the person gave, and at least one value");
  }
  if (problems.length) return { ok: false, problems };
  const checked: CheckinDraft = { ...draft };
  if (occurredAt) checked.occurredAt = occurredAt;
  else delete checked.occurredAt;
  return { ok: true, draft: checked };
}
