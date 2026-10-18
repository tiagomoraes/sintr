"use client";

import { Button, Checkbox, FieldError, FieldHint, Input, cn } from "@sintr/ui";
import { useActionState, useState } from "react";
import type { TherapyFormState } from "@/app/(app)/therapy/actions";
import { LEADS, REPORT_LANGUAGE_OPTIONS } from "@/lib/therapy";
import { submitWith } from "@/lib/use-form-action";

export interface TherapyDefaults {
  displayName: string;
  language: "en" | "pt" | "es";
  timezone: string;
  therapistName: string;
  therapistEmail: string;
  sessionDay: number | null;
  sessionTime: string;
  reportLeadMinutes: number;
  /** The one-off session as a datetime-local value in the person's zone, or "". */
  nextSessionAt: string;
  deliveryChannel: "email" | "download";
  reportNoticeEmail: boolean;
}

const DAYS = [
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
  { value: "0", label: "Sunday" },
];

const select =
  "mt-2 block h-12 w-full max-w-md rounded-command border border-rule-strong bg-paper px-4 font-sans text-body text-ink hover:border-ink-soft focus-visible:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
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

export function TherapyForm({
  defaults,
  timezones,
  emailAvailable,
  emailVerified,
  save,
}: {
  defaults: TherapyDefaults;
  timezones: string[];
  emailAvailable: boolean;
  emailVerified: boolean;
  save: (state: TherapyFormState, form: FormData) => Promise<TherapyFormState>;
}) {
  const [state, action, pending] = useActionState(save, { saved: false, problems: {} });
  const [delivery, setDelivery] = useState(defaults.deliveryChannel);
  const [zone, setZone] = useState(defaults.timezone);
  const p = state.problems;

  return (
    <form onSubmit={submitWith(action)} className="space-y-12" aria-label="Your therapy">
      <section aria-labelledby="sessions-title" className="space-y-8">
        <h2 id="sessions-title" className="font-serif text-title-small font-normal text-ink">
          Your sessions
        </h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field id="therapy-day" label="Day" problem={p.sessionDay}>
            <select
              id="therapy-day"
              name="sessionDay"
              defaultValue={defaults.sessionDay === null ? "" : String(defaults.sessionDay)}
              className={select}
            >
              <option value="">No fixed day</option>
              {DAYS.map((day) => (
                <option key={day.value} value={day.value}>
                  {day.label}
                </option>
              ))}
            </select>
          </Field>
          <Field id="therapy-time" label="Time" problem={p.sessionTime}>
            <Input
              id="therapy-time"
              name="sessionTime"
              type="time"
              defaultValue={defaults.sessionTime}
              className="mt-2 max-w-48"
            />
          </Field>
        </div>
        <Field
          id="therapy-timezone"
          label="Your time zone"
          hint="The day and time of your sessions are read in it."
          problem={p.timezone}
        >
          <select
            id="therapy-timezone"
            name="timezone"
            value={zone}
            onChange={(event) => setZone(event.target.value)}
            className={select}
          >
            {timezones.map((name) => (
              <option key={name} value={name}>
                {name.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </Field>
        <Field
          id="therapy-moved"
          label="Has a session moved?"
          hint="Give its new date and time. It takes the place of the regular session nearest to it, just once, and the report is prepared for it instead."
          problem={p.nextSessionAt}
        >
          <Input
            id="therapy-moved"
            name="nextSessionAt"
            type="datetime-local"
            defaultValue={defaults.nextSessionAt}
            className="mt-2 max-w-72"
          />
        </Field>
        {defaults.nextSessionAt ? (
          <label className="flex items-start gap-3 text-[0.9375rem] text-ink-2">
            <Checkbox name="clearNextSession" />
            The session is back to its usual day
          </label>
        ) : null}
      </section>

      <section aria-labelledby="report-title" className="space-y-8 border-t border-rule pt-10">
        <h2 id="report-title" className="font-serif text-title-small font-normal text-ink">
          The report before each session
        </h2>
        <Field
          id="therapy-lead"
          label="When to prepare it"
          hint="It covers the days since the last report, up to that moment, so it is fresh for the session."
          problem={p.reportLeadMinutes}
        >
          <select
            id="therapy-lead"
            name="reportLeadMinutes"
            defaultValue={String(defaults.reportLeadMinutes)}
            className={select}
          >
            {LEADS.map((lead) => (
              <option key={lead.minutes} value={lead.minutes}>
                {lead.label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          id="therapy-language"
          label="The report's language"
          hint="Headings and the assistant's words follow it. Your own words stay exactly as you wrote them."
          problem={p.language}
        >
          <select id="therapy-language" name="language" defaultValue={defaults.language} className={select}>
            {REPORT_LANGUAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          id="therapy-name"
          label="Your name, as the report shows it"
          hint="Optional. Without it the report says “the week, in their own words”."
          problem={p.displayName}
        >
          <Input id="therapy-name" name="displayName" defaultValue={defaults.displayName} className="mt-2" />
        </Field>
      </section>

      <section aria-labelledby="therapist-title" className="space-y-8 border-t border-rule pt-10">
        <h2 id="therapist-title" className="font-serif text-title-small font-normal text-ink">
          Your therapist
        </h2>
        <Field id="therapy-therapist" label="Name" problem={p.therapistName}>
          <Input
            id="therapy-therapist"
            name="therapistName"
            defaultValue={defaults.therapistName}
            className="mt-2"
          />
        </Field>
        <Field
          id="therapy-email"
          label="Email"
          hint="Kept encrypted, like your diary. Used only to send a report you approved."
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
          <legend className="p-0 text-label font-medium text-ink">What happens to the report</legend>
          <div className="mt-3 inline-flex max-w-full flex-wrap gap-1 rounded-[26px] border border-rule bg-paper p-1">
            {(
              [
                { value: "email", label: "Send it to my therapist" },
                { value: "download", label: "Keep it for me" },
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
                ? "When you approve a report, you can send its PDF to this address. Each send asks for your yes."
                : "Email is not set up on this sintr yet, so you can download the PDF and share it yourself."
              : "The PDF stays with you: download it to bring to the session or share it your way."}
          </FieldHint>
          {p.deliveryChannel ? <FieldError>{p.deliveryChannel}</FieldError> : null}
        </fieldset>
        <div className="rounded-file border border-rule bg-wash px-[22px] py-5">
          <p className="text-[0.9688rem] text-ink-2">
            Every report waits for your approval. Nothing is sent to anyone without your yes for that report,
            and this cannot be turned off.
          </p>
        </div>
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
            Email me when a report is ready to read
          </label>
          <FieldHint>
            {!emailAvailable
              ? "Email is not set up on this sintr. You will see the report here when it is ready."
              : emailVerified
                ? "A link only, never the report's words."
                : "A link only, never the report's words. Confirm your email in Settings first."}
          </FieldHint>
        </div>
      </section>

      {p.form ? <FieldError>{p.form}</FieldError> : null}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Button type="submit" disabled={pending}>
          Save
        </Button>
        {state.saved ? (
          <p role="status" className="text-[0.9375rem] text-ink-2">
            Saved.
          </p>
        ) : null}
      </div>
    </form>
  );
}
