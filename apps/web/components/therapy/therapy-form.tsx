"use client";

import { Button, Checkbox, FieldError, FieldHint, Input, Select, cn } from "@sintr/ui";
import { useActionState, useRef, useState, type ReactNode } from "react";
import type { TherapyFormState } from "@/app/(app)/therapy/actions";
import { LEADS, REPORT_LANGUAGE_OPTIONS } from "@/lib/therapy";
import { submitWith } from "@/lib/use-form-action";
import { useHydrated } from "@/lib/use-hydrated";
import { useMessages } from "@/components/language";
import { useUnsaved } from "@/components/unsaved";

export interface TherapyDefaults {
  displayName: string;
  /** The report's language when the person chose one; "" follows the language they read sintr in. */
  language: "" | "en" | "pt" | "es";
  therapistName: string;
  therapistEmail: string;
  reportLeadMinutes: number;
  deliveryChannel: "email" | "download";
  reportNoticeEmail: boolean;
}

/** What is set, as sentences, one for each part of the form (the sessions are the calendar above it). */
export interface TherapySummaries {
  therapist: string;
  report: string;
}

const select = "mt-2 max-w-md";
const segmentedOption =
  "pointer-events-none flex min-h-10 items-center rounded-pill px-4 text-[0.9375rem] font-medium text-ink-2 transition-colors duration-300 peer-hover:bg-wash peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink";

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
  children: ReactNode;
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
 * One part of the page: its sentence first, and the fields to change it
 * behind it. A part with a problem in it opens by itself.
 */
function Part({
  id,
  title,
  summary,
  open,
  children,
}: {
  id: string;
  title: string;
  summary: string;
  open: boolean;
  children: ReactNode;
}) {
  const T = useMessages().therapy;
  return (
    <details open={open || undefined} className="group border-t border-rule py-7">
      <summary className="flex cursor-pointer list-none flex-wrap items-baseline justify-between gap-x-6 gap-y-2 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span id={`${id}-title`} className="block text-label font-medium text-ink-3">
            {title}
          </span>
          <span className="mt-1.5 block font-serif text-title-small leading-snug text-ink">{summary}</span>
        </span>
        <span className="inline-flex items-center gap-2 text-[0.9375rem] font-medium text-ink-2 group-hover:text-ink">
          <span
            aria-hidden="true"
            className="inline-block size-[7px] -translate-y-px rotate-[-45deg] border-b-[1.5px] border-r-[1.5px] border-current transition-transform duration-[400ms] group-open:rotate-45"
          />
          {T.change}
        </span>
      </summary>
      <div className="sintr-rise mt-8 space-y-8">{children}</div>
    </details>
  );
}

export function TherapyForm({
  defaults,
  summaries,
  emailAvailable,
  emailVerified,
  readIn,
  save,
}: {
  defaults: TherapyDefaults;
  /** The name of the language the person reads sintr in, which the report follows unless they choose. */
  readIn: string;
  summaries: TherapySummaries;
  emailAvailable: boolean;
  emailVerified: boolean;
  save: (state: TherapyFormState, form: FormData) => Promise<TherapyFormState>;
}) {
  const T = useMessages().therapy;
  const [state, action, pending] = useActionState(save, { saved: false, problems: {} });
  const hydrated = useHydrated();
  const form = useRef<HTMLFormElement>(null);
  // Leaving with a change here asks first (DECISIONS 113); the calendar above moves without leaving.
  useUnsaved(
    form,
    {
      therapistName: T.unsaved.therapist,
      therapistEmail: T.unsaved.therapist,
      deliveryChannel: T.unsaved.therapist,
      reportLeadMinutes: T.unsaved.report,
      language: T.unsaved.report,
      displayName: T.unsaved.report,
      reportNoticeEmail: T.unsaved.report,
    },
    state.saved ? state : null,
  );
  const [delivery, setDelivery] = useState(defaults.deliveryChannel);
  const p = state.problems;
  const has = (...fields: string[]) => fields.some((field) => Boolean(p[field]));

  return (
    // A post, and a Save that waits for the page to be alive: the therapist's email never travels in an address.
    <form ref={form} method="post" action="/therapy" onSubmit={submitWith(action)} aria-label={T.title}>
      <Part
        id="therapist"
        title={T.therapist.title}
        summary={summaries.therapist}
        open={has("therapistName", "therapistEmail", "deliveryChannel")}
      >
        <Field id="therapy-therapist" label={T.therapist.name} problem={p.therapistName}>
          <Input
            id="therapy-therapist"
            name="therapistName"
            defaultValue={defaults.therapistName}
            className="mt-2"
          />
        </Field>
        <Field
          id="therapy-email"
          label={T.therapist.email}
          hint={T.therapist.emailHint}
          problem={p.therapistEmail}
        >
          <Input
            id="therapy-email"
            name="therapistEmail"
            type="email"
            autoComplete="off"
            defaultValue={defaults.therapistEmail}
            className="mt-2"
          />
        </Field>
        <fieldset className="min-w-0 border-0 p-0">
          <legend className="p-0 text-label font-medium text-ink">{T.therapist.delivery}</legend>
          <div className="mt-3 inline-flex max-w-full flex-wrap gap-1 rounded-[26px] border border-rule bg-paper p-1">
            {(
              [
                { value: "email", label: T.therapist.send },
                { value: "download", label: T.therapist.keep },
              ] as const
            ).map((option) => (
              <label key={option.value} className="relative">
                <input
                  type="radio"
                  name="deliveryChannel"
                  value={option.value}
                  checked={delivery === option.value}
                  onChange={() => setDelivery(option.value)}
                  className="peer absolute inset-0 cursor-pointer opacity-0"
                />
                <span className={segmentedOption}>{option.label}</span>
              </label>
            ))}
          </div>
          <FieldHint>
            {delivery === "email"
              ? emailAvailable
                ? T.therapist.sendHint
                : T.therapist.sendOff
              : T.therapist.keepHint}
          </FieldHint>
          {p.deliveryChannel ? <FieldError>{p.deliveryChannel}</FieldError> : null}
        </fieldset>
      </Part>

      <Part
        id="report"
        title={T.report.title}
        summary={summaries.report}
        open={has("reportLeadMinutes", "language", "displayName")}
      >
        <Field id="therapy-lead" label={T.report.lead} hint={T.report.leadHint} problem={p.reportLeadMinutes}>
          <Select
            id="therapy-lead"
            name="reportLeadMinutes"
            defaultValue={String(defaults.reportLeadMinutes)}
            className={select}
          >
            {LEADS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {T.report.leads[minutes]}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          id="therapy-language"
          label={T.report.language}
          hint={T.report.languageHint}
          problem={p.language}
        >
          <Select id="therapy-language" name="language" defaultValue={defaults.language} className={select}>
            <option value="">{T.report.languageFollow(readIn)}</option>
            {REPORT_LANGUAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="therapy-name" label={T.report.name} hint={T.report.nameHint} problem={p.displayName}>
          <Input id="therapy-name" name="displayName" defaultValue={defaults.displayName} className="mt-2" />
        </Field>
        <div>
          <label
            className={cn(
              "flex items-start gap-3 text-[0.9375rem] text-ink-2",
              !emailAvailable && "opacity-60",
            )}
          >
            <Checkbox
              name="reportNoticeEmail"
              defaultChecked={defaults.reportNoticeEmail}
              disabled={!emailAvailable}
            />
            {T.report.notice}
          </label>
          <FieldHint>
            {!emailAvailable ? T.report.noticeOff : emailVerified ? T.report.noticeOn : T.report.noticeVerify}
          </FieldHint>
        </div>
      </Part>

      <div className="rounded-file border border-rule bg-wash px-[22px] py-5">
        <p className="text-[0.9688rem] text-ink-2">{T.approval}</p>
      </div>
      {p.form ? <FieldError>{p.form}</FieldError> : null}
      <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Button type="submit" disabled={pending || !hydrated}>
          {T.save}
        </Button>
        {state.saved ? (
          <p role="status" className="text-[0.9375rem] text-ink-2">
            {T.saved}
          </p>
        ) : null}
      </div>
    </form>
  );
}
