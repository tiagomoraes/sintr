"use client";

import { Button, Checkbox, FieldError, FieldHint, Input, cn } from "@sintr/ui";
import { useActionState } from "react";
import type { PracticeFormState } from "@/app/(app)/practice/actions";
import { useMessages } from "@/components/language";
import { useHydrated } from "@/lib/use-hydrated";
import { submitWith } from "@/lib/use-form-action";

function Field({
  id,
  label,
  hint,
  problem,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  problem?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-label font-medium text-ink">
        {label}
      </label>
      {children}
      {hint ? <FieldHint>{hint}</FieldHint> : null}
      {problem ? <FieldError>{problem}</FieldError> : null}
    </div>
  );
}

/**
 * The practice's names: what the people it invites see. Used to open the
 * practice, and later to change it (with the email notice).
 */
export function PracticeForm({
  save,
  defaults,
  submitLabel,
  notify,
}: {
  save: (state: PracticeFormState, form: FormData) => Promise<PracticeFormState>;
  defaults: { professionalName: string; practiceName: string; registration: string };
  submitLabel: string;
  /** The email notice, when editing an open practice. */
  notify?: { checked: boolean; available: boolean; hint: string };
}) {
  const t = useMessages().practice;
  const hydrated = useHydrated();
  const [state, action, pending] = useActionState(save, { saved: false, problems: {} });
  const p = state.problems;
  return (
    <form onSubmit={submitWith(action)} className="space-y-8" aria-label={t.title}>
      <Field id="practice-name" label={t.form.name} hint={t.form.nameHint} problem={p.professionalName}>
        <Input
          id="practice-name"
          name="professionalName"
          defaultValue={defaults.professionalName}
          maxLength={120}
          required
          className="mt-2 max-w-md"
        />
      </Field>
      <Field id="practice-place" label={t.form.place} hint={t.form.optional} problem={p.practiceName}>
        <Input
          id="practice-place"
          name="practiceName"
          defaultValue={defaults.practiceName}
          maxLength={160}
          className="mt-2 max-w-md"
        />
      </Field>
      <Field
        id="practice-registration"
        label={t.form.registration}
        hint={t.form.registrationHint}
        problem={p.registration}
      >
        <Input
          id="practice-registration"
          name="registration"
          defaultValue={defaults.registration}
          maxLength={120}
          className="mt-2 max-w-md"
        />
      </Field>
      {notify ? (
        <div>
          <label
            className={cn(
              "flex items-start gap-3 text-[0.9375rem] text-ink-2",
              !notify.available && "opacity-60",
            )}
          >
            <Checkbox name="notifyEmail" defaultChecked={notify.checked} disabled={!notify.available} />
            {t.form.notify}
          </label>
          <FieldHint>{notify.hint}</FieldHint>
        </div>
      ) : null}
      {p.form ? <FieldError>{p.form}</FieldError> : null}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Button type="submit" disabled={!hydrated || pending}>
          {submitLabel}
        </Button>
        {state.saved ? (
          <p role="status" className="text-[0.9375rem] text-ink-2">
            {t.form.saved}
          </p>
        ) : null}
      </div>
    </form>
  );
}
