"use client";

import { Button, Checkbox, FieldError, FieldHint, Input, Label } from "@sintr/ui";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import type { ConfirmState, NameState } from "@/app/(app)/sharing/actions";
import { useMessages } from "@/components/language";
import { Segmented } from "@/components/segmented";
import { submitWith } from "@/lib/use-form-action";
import type { ShareMode } from "@sintr/core";

/** "Ask me each time" or "Send what I approve", saved as soon as it is chosen. */
export function ModeForm({ mode, save }: { mode: ShareMode; save: (form: FormData) => Promise<void> }) {
  const t = useMessages().sharing;
  const form = useRef<HTMLFormElement>(null);
  const [chosen, setChosen] = useState(mode);
  const modes = (["ask", "auto"] as const).map((value) => ({ value, label: t.modes[value].label }));
  return (
    <form ref={form} action={save}>
      <fieldset className="min-w-0 border-0 p-0">
        <legend className="p-0 text-label font-medium text-ink">{t.mode.legend}</legend>
        <Segmented
          name="shareMode"
          options={modes}
          defaultValue={mode}
          onChange={(value) => {
            setChosen(value);
            // Saved on choice; the button below is for a browser without JavaScript.
            form.current?.requestSubmit();
          }}
          className="mt-3"
        />
        <FieldHint>{t.modes[chosen].sentence}</FieldHint>
        <noscript>
          <Button type="submit" variant="outline" size="sm" className="mt-3">
            {t.mode.save}
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
  reportName,
  save,
}: {
  name: string | null;
  neutral: string;
  /** The name the person put on their reports in Therapy: printed on every report, shared ones included. */
  reportName: string | null;
  save: (state: NameState, form: FormData) => Promise<NameState>;
}) {
  const t = useMessages().sharing.name;
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(save, { saved: false, problem: null });
  const id = useId();
  if (!editing) {
    return (
      <p className="text-[0.9375rem] text-ink-2">
        {t.seenAs} <span className="font-serif text-[1.0625rem] text-ink">{name ?? neutral}</span>
        {name ? t.afterName : t.afterNeutral}{" "}
        <Button
          type="button"
          variant="quiet"
          size="inline"
          className="text-[0.9375rem] underline decoration-rule-strong underline-offset-[0.28em]"
          onClick={() => setEditing(true)}
        >
          {t.change}
        </Button>
        {reportName ? (
          <span className="mt-1 block text-caption text-ink-3">{t.reportName(reportName)}</span>
        ) : null}
      </p>
    );
  }
  return (
    <form
      onSubmit={submitWith((form) => {
        action(form);
        setEditing(false);
      })}
      aria-label={t.label}
    >
      <Label htmlFor={id}>{t.label}</Label>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Input id={id} name="personName" defaultValue={name ?? ""} maxLength={80} className="max-w-[18rem]" />
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {t.save}
        </Button>
        <Button type="button" variant="quiet" size="sm" onClick={() => setEditing(false)}>
          {t.cancel}
        </Button>
      </div>
      <FieldHint>{t.empty(neutral)}</FieldHint>
      {state.problem ? <FieldError>{state.problem}</FieldError> : null}
    </form>
  );
}

/** The person's yes to a practice that accepted their invite: the consent, then the link is active. */
export function ConfirmForm({
  who,
  shown,
  confirm,
  decline,
}: {
  who: string;
  /** The practice as this page shows it; the consent names exactly that. */
  shown: string;
  confirm: (state: ConfirmState, form: FormData) => Promise<ConfirmState>;
  decline: () => Promise<void>;
}) {
  const t = useMessages().sharing;
  const [state, action, pending] = useActionState(confirm, { problem: null });
  const [declining, setDeclining] = useState(false);
  const id = useId();
  return (
    <div>
      <form onSubmit={submitWith(action)} aria-label={t.pending.form} className="space-y-5">
        <input type="hidden" name="shown" value={shown} />
        <div className="flex items-start gap-3">
          <Checkbox id={id} name="consent" />
          <label htmlFor={id} className="text-[0.9688rem] leading-[1.55] text-ink-2">
            {t.consent.before} <span className="font-medium text-ink">{who}</span>
            {t.consent.afterHere}
          </label>
        </div>
        {state.problem ? <FieldError>{state.problem}</FieldError> : null}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <Button type="submit" disabled={pending || declining}>
            {pending ? t.pending.confirming : t.pending.confirm}
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
            {declining ? t.pending.declining : t.pending.decline}
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
