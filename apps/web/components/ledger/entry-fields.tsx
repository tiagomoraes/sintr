"use client";

import { FieldError, FieldHint, Input, Textarea, cn } from "@sintr/ui";
import { useId, useState, type ReactNode } from "react";
import type { FormProblems } from "@/lib/forms";
import { toLocalInput } from "@/lib/time";
import { useMessages } from "@/components/language";
import type { EntryView } from "./entry-rows";

export interface EntryDefaults extends EntryView {
  occurredAt?: string | Date | null;
}

let rowCounter = 0;
const rowKey = () => `row-${(rowCounter += 1)}`;

const labelClass = "block text-label font-medium text-ink";
const smallButton =
  "inline-flex min-h-9 items-center rounded-pill border border-rule px-4 text-[0.875rem] font-medium text-ink-2 transition-colors duration-300 hover:border-rule-strong hover:text-ink";
const removeButton =
  "shrink-0 self-center px-2 py-2 text-[0.875rem] text-ink-3 underline-offset-4 hover:text-ink hover:underline";

function Field({
  label,
  hint,
  problem,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  problem?: string | undefined;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
      </label>
      <div className="mt-2">{children}</div>
      {hint ? <FieldHint>{hint}</FieldHint> : null}
      {problem ? <FieldError>{problem}</FieldError> : null}
    </div>
  );
}

function Group({
  legend,
  hint,
  problem,
  children,
}: {
  legend: string;
  hint?: string;
  problem?: string | undefined;
  children: ReactNode;
}) {
  return (
    <fieldset className="min-w-0 border-0 p-0">
      <legend className={cn(labelClass, "p-0")}>{legend}</legend>
      {hint ? <p className="mt-1 text-caption text-ink-3">{hint}</p> : null}
      <div className="mt-3 space-y-3">{children}</div>
      {problem ? <FieldError>{problem}</FieldError> : null}
    </fieldset>
  );
}

interface EmotionRow {
  key: string;
  name: string;
  intensity: string;
}

function emotionRows(emotions: EntryView["emotions"]): EmotionRow[] {
  const rows = (emotions ?? []).map((emotion) => ({
    key: rowKey(),
    name: emotion.name,
    intensity: typeof emotion.intensity === "number" ? String(emotion.intensity) : "",
  }));
  return rows.length > 0 ? rows : [{ key: rowKey(), name: "", intensity: "" }];
}

function EmotionList({
  label,
  names,
  intensities,
  rows,
  setRows,
}: {
  /** A screen reader's name for the nth emotion's box. */
  label: (n: number) => string;
  names: string;
  intensities: string;
  rows: EmotionRow[];
  setRows: (rows: EmotionRow[]) => void;
}) {
  const F = useMessages().entry.form;
  const update = (key: string, patch: Partial<EmotionRow>) =>
    setRows(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  return (
    <>
      {rows.map((row, index) => (
        <div key={row.key} className="flex items-start gap-3">
          <Input
            name={names}
            value={row.name}
            onChange={(event) => update(row.key, { name: event.target.value })}
            aria-label={label(index + 1)}
            placeholder={F.emotionPlaceholder}
            className="min-w-0 flex-1"
          />
          <Input
            name={intensities}
            value={row.intensity}
            onChange={(event) => update(row.key, { intensity: event.target.value })}
            aria-label={F.strength}
            placeholder={F.strengthPlaceholder}
            inputMode="numeric"
            pattern="[0-9]{0,3}"
            className="w-28 shrink-0 tabular-nums"
          />
          {rows.length > 1 ? (
            <button
              type="button"
              className={removeButton}
              onClick={() => setRows(rows.filter((r) => r.key !== row.key))}
            >
              {F.remove}
            </button>
          ) : null}
        </div>
      ))}
      <button
        type="button"
        className={smallButton}
        onClick={() => setRows([...rows, { key: rowKey(), name: "", intensity: "" }])}
      >
        {F.addEmotion}
      </button>
    </>
  );
}

/**
 * Every field of a thought record, prefilled. Used to edit a draft before
 * saving it and to correct a saved entry. Empty fields stay empty.
 */
export function EntryFields({
  defaults,
  timezone,
  problems = {},
  correctionNote = false,
}: {
  defaults: EntryDefaults;
  timezone: string;
  problems?: FormProblems;
  correctionNote?: boolean;
}) {
  const { labels: L, form: F, corrections: C } = useMessages().entry;
  const id = useId();
  const [thoughts, setThoughts] = useState(() => {
    const rows = (defaults.thoughts ?? []).map((text) => ({ key: rowKey(), text }));
    return rows.length > 0 ? rows : [{ key: rowKey(), text: "" }];
  });
  const [emotions, setEmotions] = useState(() => emotionRows(defaults.emotions));
  const [after, setAfter] = useState(() => emotionRows(defaults.emotionsAfter));
  const deeper = Boolean(
    defaults.hotThought ||
    defaults.evidenceFor ||
    defaults.evidenceAgainst ||
    defaults.alternative ||
    defaults.emotionsAfter?.length ||
    typeof defaults.alternativeBelief === "number",
  );
  // The rest of the record opens by itself when it already holds something.
  const more = Boolean(
    defaults.title ||
    defaults.body ||
    defaults.behavior ||
    defaults.context ||
    defaults.notes ||
    defaults.tags?.length,
  );
  const when = defaults.occurredAt ? toLocalInput(new Date(defaults.occurredAt), timezone) : "";

  return (
    <div className="space-y-7">
      <Field
        label={L.occurredAt}
        htmlFor={`${id}-when`}
        hint={when ? F.whenHint : F.whenEmptyHint}
        problem={problems.occurredAt}
      >
        <input type="hidden" name="occurredAtShown" value={when} />
        <Input
          id={`${id}-when`}
          type="datetime-local"
          name="occurredAt"
          defaultValue={when}
          className="max-w-xs"
        />
      </Field>
      <Field label={L.situation} htmlFor={`${id}-situation`} hint={F.situationHint}>
        <Textarea id={`${id}-situation`} name="situation" rows={4} defaultValue={defaults.situation ?? ""} />
      </Field>
      <Group legend={L.thoughts} hint={F.thoughtsHint}>
        {thoughts.map((thought, index) => (
          <div key={thought.key} className="flex items-start gap-3">
            <Textarea
              name="thought"
              rows={2}
              value={thought.text}
              onChange={(event) =>
                setThoughts(
                  thoughts.map((t) => (t.key === thought.key ? { ...t, text: event.target.value } : t)),
                )
              }
              aria-label={F.thought(index + 1)}
              className="min-w-0 flex-1"
            />
            {thoughts.length > 1 ? (
              <button
                type="button"
                className={removeButton}
                onClick={() => setThoughts(thoughts.filter((t) => t.key !== thought.key))}
              >
                {F.remove}
              </button>
            ) : null}
          </div>
        ))}
        <button
          type="button"
          className={smallButton}
          onClick={() => setThoughts([...thoughts, { key: rowKey(), text: "" }])}
        >
          {F.addThought}
        </button>
      </Group>
      <Group legend={L.emotions} hint={F.emotionsHint} problem={problems.emotions}>
        <EmotionList
          label={F.emotion}
          names="emotionName"
          intensities="emotionIntensity"
          rows={emotions}
          setRows={setEmotions}
        />
      </Group>
      <details open={more} className="group border-t border-rule pt-6">
        <summary className="cursor-pointer list-none text-label font-medium text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
          <span
            aria-hidden="true"
            className="mr-2.5 inline-block size-[7px] -translate-y-px rotate-[-45deg] border-b-[1.5px] border-r-[1.5px] border-current transition-transform duration-[400ms] group-open:rotate-45"
          />
          {F.more}
        </summary>
        <p className="mt-2 max-w-[36em] text-caption text-ink-3">{F.moreHint}</p>
        <div className="mt-6 space-y-7">
          <Field label={L.body} htmlFor={`${id}-body`}>
            <Textarea id={`${id}-body`} name="body" rows={2} defaultValue={defaults.body ?? ""} />
          </Field>
          <Field label={L.behavior} htmlFor={`${id}-behavior`} hint={F.behaviorHint}>
            <Textarea id={`${id}-behavior`} name="behavior" rows={2} defaultValue={defaults.behavior ?? ""} />
          </Field>
          <Field label={L.context} htmlFor={`${id}-context`} hint={F.contextHint}>
            <Textarea id={`${id}-context`} name="context" rows={2} defaultValue={defaults.context ?? ""} />
          </Field>
          <Field label={L.tags} htmlFor={`${id}-tags`} hint={F.tagsHint}>
            <Input id={`${id}-tags`} name="tags" defaultValue={(defaults.tags ?? []).join(", ")} />
          </Field>
          <Field label={L.notes} htmlFor={`${id}-notes`}>
            <Textarea id={`${id}-notes`} name="notes" rows={3} defaultValue={defaults.notes ?? ""} />
          </Field>
          <Field label={L.title} htmlFor={`${id}-title`} hint={F.titleHint}>
            <Input id={`${id}-title`} name="title" defaultValue={defaults.title ?? ""} />
          </Field>
        </div>
      </details>

      <details open={deeper} className="group border-t border-rule pt-6">
        <summary className="cursor-pointer list-none text-label font-medium text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
          <span
            aria-hidden="true"
            className="mr-2.5 inline-block size-[7px] -translate-y-px rotate-[-45deg] border-b-[1.5px] border-r-[1.5px] border-current transition-transform duration-[400ms] group-open:rotate-45"
          />
          {F.deeper}
        </summary>
        <p className="mt-2 max-w-[36em] text-caption text-ink-3">{F.deeperHint}</p>
        <div className="mt-6 space-y-7">
          <Field label={L.hotThought} htmlFor={`${id}-hot`}>
            <Textarea id={`${id}-hot`} name="hotThought" rows={2} defaultValue={defaults.hotThought ?? ""} />
          </Field>
          <Field label={L.evidenceFor} htmlFor={`${id}-for`} hint={F.evidenceForHint}>
            <Textarea
              id={`${id}-for`}
              name="evidenceFor"
              rows={2}
              defaultValue={defaults.evidenceFor ?? ""}
            />
          </Field>
          <Field label={L.evidenceAgainst} htmlFor={`${id}-against`}>
            <Textarea
              id={`${id}-against`}
              name="evidenceAgainst"
              rows={2}
              defaultValue={defaults.evidenceAgainst ?? ""}
            />
          </Field>
          <Field label={L.alternative} htmlFor={`${id}-alt`}>
            <Textarea
              id={`${id}-alt`}
              name="alternative"
              rows={2}
              defaultValue={defaults.alternative ?? ""}
            />
          </Field>
          <Field
            label={L.alternativeBelief}
            htmlFor={`${id}-belief`}
            hint={F.beliefHint}
            problem={problems.alternativeBelief}
          >
            <Input
              id={`${id}-belief`}
              name="alternativeBelief"
              inputMode="numeric"
              pattern="[0-9]{0,3}"
              defaultValue={
                typeof defaults.alternativeBelief === "number" ? String(defaults.alternativeBelief) : ""
              }
              className="w-28 tabular-nums"
            />
          </Field>
          <Group legend={L.emotionsAfter} hint={F.afterHint} problem={problems.emotionsAfter}>
            <EmotionList
              label={F.emotionAfter}
              names="afterName"
              intensities="afterIntensity"
              rows={after}
              setRows={setAfter}
            />
          </Group>
        </div>
      </details>

      {correctionNote ? (
        <div className="border-t border-rule pt-6">
          <Field label={C.note} htmlFor={`${id}-note`} hint={C.noteHint}>
            <Textarea id={`${id}-note`} name="correctionNote" rows={2} />
          </Field>
        </div>
      ) : null}
    </div>
  );
}
