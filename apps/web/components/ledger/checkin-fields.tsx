"use client";

import { FieldError, FieldHint, Input, Textarea } from "@sintr/ui";
import { useLanguage, useMessages } from "@/components/language";
import type { FormProblems } from "@/lib/forms";
import { toLocalInput } from "@/lib/time";
import type { CheckinView } from "./checkin-values";

export interface CheckinDefaults extends CheckinView {
  occurredAt?: string | Date | null;
}

const OPTIONS = ["none", "0", "1", "2", "3", "4", "5"] as const;

/**
 * A 0 to 5 scale as the segmented toggle of the design system: native
 * radios, so it works with the keyboard and without JavaScript. "Not given"
 * is where every scale starts: no value is chosen for the person.
 */
function Scale({
  name,
  label,
  hint,
  value,
  problem,
}: {
  name: "mood" | "energy" | "anxiety";
  label: string;
  hint: string;
  value: number | null | undefined;
  problem?: string | undefined;
}) {
  const { notGiven } = useMessages().checkin.form;
  const current = typeof value === "number" ? String(value) : "none";
  return (
    <fieldset className="min-w-0 border-0 p-0">
      <legend className="p-0 text-label font-medium text-ink">{label}</legend>
      <p className="mt-1 text-caption text-ink-3">{hint}</p>
      <div className="mt-3 inline-flex max-w-full flex-wrap gap-1 rounded-[26px] border border-rule bg-paper p-1">
        {OPTIONS.map((option) => (
          <label key={option} className="relative">
            <input
              type="radio"
              name={name}
              value={option}
              defaultChecked={option === current}
              className="peer absolute inset-0 cursor-pointer opacity-0"
            />
            <span className="pointer-events-none flex min-h-10 min-w-11 items-center justify-center rounded-pill px-3.5 text-[0.9375rem] font-medium tabular-nums text-ink-2 transition-colors duration-300 peer-hover:bg-wash peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink">
              {option === "none" ? notGiven : option}
            </span>
          </label>
        ))}
      </div>
      {problem ? <FieldError>{problem}</FieldError> : null}
    </fieldset>
  );
}

/**
 * Every question of a check-in at once, to change one or a draft: every
 * value optional, nothing preselected.
 */
export function CheckinFields({
  defaults = {},
  timezone,
  problems = {},
  correctionNote = false,
}: {
  defaults?: CheckinDefaults;
  timezone: string;
  problems?: FormProblems;
  correctionNote?: boolean;
}) {
  const t = useMessages();
  const { labels: L, form: F, sleep: S } = t.checkin;
  const { intl } = useLanguage();
  const when = defaults.occurredAt ? toLocalInput(new Date(defaults.occurredAt), timezone) : "";
  // Hours as the page writes a number ("7.5", "7,5"); the form reads either.
  const hours =
    typeof defaults.sleepHours === "number"
      ? new Intl.NumberFormat(intl, { useGrouping: false }).format(defaults.sleepHours)
      : "";
  return (
    <div className="space-y-8">
      <Scale name="mood" label={L.mood} hint={F.hints.mood} value={defaults.mood} problem={problems.mood} />
      <Scale
        name="energy"
        label={L.energy}
        hint={F.hints.energy}
        value={defaults.energy}
        problem={problems.energy}
      />
      <Scale
        name="anxiety"
        label={L.anxiety}
        hint={F.hints.anxiety}
        value={defaults.anxiety}
        problem={problems.anxiety}
      />
      <div className="grid gap-6 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <div>
          <label htmlFor="checkin-sleep" className="block text-label font-medium text-ink">
            {S.hours}
          </label>
          <Input
            id="checkin-sleep"
            name="sleepHours"
            inputMode="decimal"
            placeholder={S.hoursPlaceholder}
            defaultValue={hours}
            className="mt-2 tabular-nums"
            aria-invalid={problems.sleepHours ? true : undefined}
          />
          {problems.sleepHours ? <FieldError>{problems.sleepHours}</FieldError> : null}
        </div>
        <div>
          <label htmlFor="checkin-quality" className="block text-label font-medium text-ink">
            {L.sleepQuality}
          </label>
          <Input
            id="checkin-quality"
            name="sleepQuality"
            placeholder={S.qualityPlaceholder}
            defaultValue={defaults.sleepQuality ?? ""}
            className="mt-2"
          />
        </div>
      </div>
      <div>
        <label htmlFor="checkin-note" className="block text-label font-medium text-ink">
          {L.note}
        </label>
        <Textarea
          id="checkin-note"
          name="note"
          rows={3}
          defaultValue={defaults.note ?? ""}
          className="mt-2"
        />
        <FieldHint>{F.noteHint}</FieldHint>
      </div>
      <div>
        <label htmlFor="checkin-when" className="block text-label font-medium text-ink">
          {L.occurredAt}
        </label>
        <input type="hidden" name="occurredAtShown" value={when} />
        <Input
          id="checkin-when"
          type="datetime-local"
          name="occurredAt"
          defaultValue={when}
          className="mt-2 max-w-xs"
        />
        <FieldHint>{F.whenHint}</FieldHint>
        {problems.occurredAt ? <FieldError>{problems.occurredAt}</FieldError> : null}
      </div>
      {correctionNote ? (
        <div className="border-t border-rule pt-6">
          <label htmlFor="checkin-correction" className="block text-label font-medium text-ink">
            {t.entry.corrections.note}
          </label>
          <Textarea id="checkin-correction" name="correctionNote" rows={2} className="mt-2" />
          <FieldHint>{t.entry.corrections.noteHint}</FieldHint>
        </div>
      ) : null}
    </div>
  );
}
