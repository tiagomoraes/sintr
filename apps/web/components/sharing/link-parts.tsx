"use client";

import { Button, Checkbox, FieldError, FieldHint, Input, Label } from "@sintr/ui";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import type { ConfirmState, NameState } from "@/app/(app)/sharing/actions";
import { Segmented } from "@/components/segmented";
import { MODE_COPY } from "@/lib/sharing";
import { submitWith } from "@/lib/use-form-action";
import type { ShareMode } from "@sintr/core";

const MODES = (["ask", "auto"] as const).map((value) => ({ value, label: MODE_COPY[value].label }));

/** "Ask me each time" or "Send what I approve", saved as soon as it is chosen. */
export function ModeForm({ mode, save }: { mode: ShareMode; save: (form: FormData) => Promise<void> }) {
  const form = useRef<HTMLFormElement>(null);
  const [chosen, setChosen] = useState(mode);
  return (
    <form ref={form} action={save}>
      <fieldset className="min-w-0 border-0 p-0">
        <legend className="p-0 text-label font-medium text-ink">When you approve a report</legend>
        <Segmented
          name="shareMode"
          options={MODES}
          defaultValue={mode}
          onChange={(value) => {
            setChosen(value);
            // Saved on choice; the button below is for a browser without JavaScript.
            form.current?.requestSubmit();
          }}
          className="mt-3"
        />
        <FieldHint>{MODE_COPY[chosen].sentence}</FieldHint>
        <noscript>
          <Button type="submit" variant="outline" size="sm" className="mt-3">
            Save
          </Button>
        </noscript>
      </fieldset>
    </form>
  );
}

/** The name the practice sees, changed in place. */
export function NameForm({
  name,
  neutral,
  save,
}: {
  name: string | null;
  neutral: string;
  save: (state: NameState, form: FormData) => Promise<NameState>;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(save, { saved: false, problem: null });
  const id = useId();
  if (!editing) {
    return (
      <p className="text-[0.9375rem] text-ink-2">
        {name ? (
          <>
            They see you as <span className="font-serif text-[1.0625rem] text-ink">{name}</span>.
          </>
        ) : (
          <>
            They see you as <span className="font-serif text-[1.0625rem] text-ink">{neutral}</span>, a neutral
            label.
          </>
        )}{" "}
        <Button
          type="button"
          variant="quiet"
          size="inline"
          className="text-[0.9375rem] underline decoration-rule-strong underline-offset-[0.28em]"
          onClick={() => setEditing(true)}
        >
          Change it
        </Button>
      </p>
    );
  }
  return (
    <form
      onSubmit={submitWith((form) => {
        action(form);
        setEditing(false);
      })}
      aria-label="How they see you"
    >
      <Label htmlFor={id}>How they see you</Label>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Input id={id} name="personName" defaultValue={name ?? ""} maxLength={80} className="max-w-[18rem]" />
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          Save
        </Button>
        <Button type="button" variant="quiet" size="sm" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
      <FieldHint>Leave it empty and they see {neutral}.</FieldHint>
      {state.problem ? <FieldError>{state.problem}</FieldError> : null}
    </form>
  );
}

/** The person's yes to a practice that accepted their invite: the consent, then the link is active. */
export function ConfirmForm({
  who,
  confirm,
  decline,
}: {
  who: string;
  confirm: (state: ConfirmState, form: FormData) => Promise<ConfirmState>;
  decline: () => Promise<void>;
}) {
  const [state, action, pending] = useActionState(confirm, { problem: null });
  const [declining, setDeclining] = useState(false);
  const id = useId();
  return (
    <div>
      <form onSubmit={submitWith(action)} aria-label="Confirm the link" className="space-y-5">
        <div className="flex items-start gap-3">
          <Checkbox id={id} name="consent" />
          <label htmlFor={id} className="text-[0.9688rem] leading-[1.55] text-ink-2">
            I agree to share the reports I approve with <span className="font-medium text-ink">{who}</span>,
            as described here. I can stop at any time.
          </label>
        </div>
        {state.problem ? <FieldError>{state.problem}</FieldError> : null}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <Button type="submit" disabled={pending || declining}>
            {pending ? "Confirming" : "Confirm, it is my therapist"}
          </Button>
          <Button
            type="button"
            variant="quiet"
            size="sm"
            disabled={pending || declining}
            onClick={() => {
              setDeclining(true);
              void decline();
            }}
          >
            {declining ? "Declining" : "It is not my therapist"}
          </Button>
        </div>
      </form>
    </div>
  );
}

/**
 * Marks the shown notices read once they are on screen, then refreshes so
 * the navigation's dot clears. The notices stay listed; only "New" goes.
 */
export function MarkSeen({ action }: { action: () => Promise<void> }) {
  const router = useRouter();
  useEffect(() => {
    void action().then(() => router.refresh());
  }, [action, router]);
  return null;
}
