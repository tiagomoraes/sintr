"use client";

import { Button, Checkbox, FieldError, FieldHint, Input, Label } from "@sintr/ui";
import { useActionState, useId, useState } from "react";
import type { JoinState } from "@/app/join/[code]/actions";
import { Segmented } from "@/components/segmented";
import { MODE_COPY } from "@/lib/sharing";
import { useHydrated } from "@/lib/use-hydrated";
import { submitWith } from "@/lib/use-form-action";

const MODES = (["ask", "auto"] as const).map((value) => ({ value, label: MODE_COPY[value].label }));

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
  const hydrated = useHydrated();
  const [state, action, pending] = useActionState(accept, { problem: null });
  const [mode, setMode] = useState<"ask" | "auto">("ask");
  const ids = { name: useId(), consent: useId() };
  return (
    <form onSubmit={submitWith(action)} className="space-y-8" aria-label="Accept the invite">
      <input type="hidden" name="shown" value={shown} />
      <div>
        <Label htmlFor={ids.name}>How they will see you</Label>
        <Input
          id={ids.name}
          name="personName"
          defaultValue={defaultName}
          maxLength={80}
          autoComplete="off"
          className="mt-2 max-w-md"
        />
        <FieldHint>
          Optional. The name they know you by, in their list. Left empty, they see a neutral label instead.
          {reportName ? ` Your reports themselves show the name you set in Therapy, ${reportName}.` : ""}
        </FieldHint>
      </div>
      <fieldset className="min-w-0 border-0 p-0">
        <legend className="p-0 text-label font-medium text-ink">When you approve a report</legend>
        <Segmented name="shareMode" options={MODES} value={mode} onChange={setMode} className="mt-3" />
        <FieldHint>{MODE_COPY[mode].sentence} You can change this later.</FieldHint>
      </fieldset>
      <div className="flex items-start gap-3">
        <Checkbox id={ids.consent} name="consent" />
        <label htmlFor={ids.consent} className="text-[0.9688rem] leading-[1.55] text-ink-2">
          I agree to share the reports I approve with <span className="font-medium text-ink">{who}</span>, as
          described above. I can stop at any time.
        </label>
      </div>
      {state.problem ? <FieldError>{state.problem}</FieldError> : null}
      <Button type="submit" disabled={!hydrated || pending} className="w-full sm:w-auto">
        {pending ? "Linking" : "Accept and link"}
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
  const hydrated = useHydrated();
  const [state, action, pending] = useActionState(accept, { problem: null });
  const ids = { name: useId(), place: useId(), registration: useId() };
  return (
    <form onSubmit={submitWith(action)} className="space-y-8" aria-label="Accept for your practice">
      {practice ? (
        <p className="text-ink-2">
          You accept it for <span className="font-medium text-ink">{practice.who}</span>. {practice.seats}
        </p>
      ) : (
        <div className="space-y-6">
          <p className="text-ink-2">To accept, open your practice on sintr first. It takes one step.</p>
          <div>
            <Label htmlFor={ids.name}>Your name, as the people you see know it</Label>
            <Input id={ids.name} name="professionalName" required maxLength={120} className="mt-2 max-w-md" />
          </div>
          <div>
            <Label htmlFor={ids.place}>Practice or clinic</Label>
            <Input id={ids.place} name="practiceName" maxLength={160} className="mt-2 max-w-md" />
            <FieldHint>Optional.</FieldHint>
          </div>
          <div>
            <Label htmlFor={ids.registration}>Registration you want to show</Label>
            <Input id={ids.registration} name="registration" maxLength={120} className="mt-2 max-w-md" />
            <FieldHint>Optional, such as CRP 06/123456.</FieldHint>
          </div>
        </div>
      )}
      {state.problem ? <FieldError>{state.problem}</FieldError> : null}
      <Button type="submit" disabled={!hydrated || pending} className="w-full sm:w-auto">
        {pending ? "Accepting" : practice ? "Accept for my practice" : "Open my practice and accept"}
      </Button>
    </form>
  );
}
