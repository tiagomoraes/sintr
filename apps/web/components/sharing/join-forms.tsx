"use client";

import { Button, Checkbox, FieldError, FieldHint, Input, Label } from "@sintr/ui";
import { useActionState, useId, useState } from "react";
import type { JoinState } from "@/app/join/[code]/actions";
import { useMessages } from "@/components/language";
import { Segmented } from "@/components/segmented";
import { useHydrated } from "@/lib/use-hydrated";
import { submitWith } from "@/lib/use-form-action";

/** The person's acceptance: the name the practice sees, how reports go, and the consent. */
export function AcceptAsPersonForm({
  who,
  shown,
  defaultName,
  reportName,
  accept,
}: {
  who: string;
  /** The practice as this page shows it; the consent names exactly that. */
  shown: string;
  defaultName: string;
  /** The name the person put on their reports in Therapy, printed on every report. */
  reportName: string | null;
  accept: (state: JoinState, form: FormData) => Promise<JoinState>;
}) {
  const t = useMessages().sharing;
  const words = t.join.asPerson;
  const hydrated = useHydrated();
  const [state, action, pending] = useActionState(accept, { problem: null });
  const [mode, setMode] = useState<"ask" | "auto">("ask");
  const ids = { name: useId(), consent: useId() };
  const modes = (["ask", "auto"] as const).map((value) => ({ value, label: t.modes[value].label }));
  return (
    <form onSubmit={submitWith(action)} className="space-y-8" aria-label={words.form}>
      <input type="hidden" name="shown" value={shown} />
      <div>
        <Label htmlFor={ids.name}>{words.name}</Label>
        <Input
          id={ids.name}
          name="personName"
          defaultValue={defaultName}
          maxLength={80}
          autoComplete="off"
          className="mt-2 max-w-md"
        />
        <FieldHint>
          {words.nameHint}
          {reportName ? ` ${words.reportName(reportName)}` : ""}
        </FieldHint>
      </div>
      <fieldset className="min-w-0 border-0 p-0">
        <legend className="p-0 text-label font-medium text-ink">{t.mode.legend}</legend>
        <Segmented name="shareMode" options={modes} value={mode} onChange={setMode} className="mt-3" />
        <FieldHint>
          {t.modes[mode].sentence} {t.mode.later}
        </FieldHint>
      </fieldset>
      <div className="flex items-start gap-3">
        <Checkbox id={ids.consent} name="consent" />
        <label htmlFor={ids.consent} className="text-[0.9688rem] leading-[1.55] text-ink-2">
          {t.consent.before} <span className="font-medium text-ink">{who}</span>
          {t.consent.afterAbove}
        </label>
      </div>
      {state.problem ? <FieldError>{state.problem}</FieldError> : null}
      <Button type="submit" disabled={!hydrated || pending} className="w-full sm:w-auto">
        {pending ? words.accepting : words.accept}
      </Button>
    </form>
  );
}

/** A professional's acceptance, opening the practice first when there is none. */
export function AcceptAsPracticeForm({
  practice,
  accept,
}: {
  /** The practice it will be accepted for, or null to open one here. */
  practice: { who: string; seats: string } | null;
  accept: (state: JoinState, form: FormData) => Promise<JoinState>;
}) {
  const t = useMessages();
  const words = t.sharing.join.asPractice;
  const fields = t.practice.form;
  const hydrated = useHydrated();
  const [state, action, pending] = useActionState(accept, { problem: null });
  const ids = { name: useId(), place: useId(), registration: useId() };
  return (
    <form onSubmit={submitWith(action)} className="space-y-8" aria-label={words.form}>
      {practice ? (
        <p className="text-ink-2">
          {words.forPractice.before} <span className="font-medium text-ink">{practice.who}</span>
          {words.forPractice.after} {practice.seats}
        </p>
      ) : (
        <div className="space-y-6">
          <p className="text-ink-2">{words.open}</p>
          <div>
            <Label htmlFor={ids.name}>{fields.name}</Label>
            <Input id={ids.name} name="professionalName" required maxLength={120} className="mt-2 max-w-md" />
          </div>
          <div>
            <Label htmlFor={ids.place}>{fields.place}</Label>
            <Input id={ids.place} name="practiceName" maxLength={160} className="mt-2 max-w-md" />
            <FieldHint>{fields.optional}</FieldHint>
          </div>
          <div>
            <Label htmlFor={ids.registration}>{fields.registration}</Label>
            <Input id={ids.registration} name="registration" maxLength={120} className="mt-2 max-w-md" />
            <FieldHint>{fields.registrationHint}</FieldHint>
          </div>
        </div>
      )}
      {state.problem ? <FieldError>{state.problem}</FieldError> : null}
      <Button type="submit" disabled={!hydrated || pending} className="w-full sm:w-auto">
        {pending ? words.accepting : practice ? words.accept : words.openAndAccept}
      </Button>
    </form>
  );
}
