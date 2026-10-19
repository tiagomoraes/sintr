"use client";

import { Button, FieldError, FieldHint, Input, Label } from "@sintr/ui";
import { useActionState, useId, useState } from "react";
import type { PatientInviteState } from "@/app/(app)/practice/actions";
import { useLanguage, useMessages } from "@/components/language";
import { InvitePanel } from "@/components/sharing/invite-panel";
import { useHydrated } from "@/lib/use-hydrated";
import { submitWith } from "@/lib/use-form-action";

function validUntil(iso: string, timezone: string, intl: string): string {
  return new Intl.DateTimeFormat(intl, {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
}

/** "Invite a patient": an optional note for the professional, one button, then the code and the link. */
export function InvitePatient({
  invite,
  timezone,
}: {
  invite: (state: PatientInviteState, form: FormData) => Promise<PatientInviteState>;
  timezone: string;
}) {
  const t = useMessages().practice.invite;
  const { intl } = useLanguage();
  const hydrated = useHydrated();
  const [state, action, pending] = useActionState(invite, { invite: null, problem: null });
  const [hidden, setHidden] = useState<string | null>(null);
  const id = useId();
  const made = state.invite && state.invite.id !== hidden ? state.invite : null;

  if (made) {
    return (
      <InvitePanel
        code={made.code}
        link={made.link}
        validUntil={validUntil(made.expiresAt, timezone, intl)}
        note={made.note}
        footer={
          <>
            <p className="mt-2 text-[0.9375rem] text-ink-3">{t.made}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-5"
              onClick={() => setHidden(made.id)}
            >
              {t.another}
            </Button>
          </>
        }
      />
    );
  }

  return (
    <form onSubmit={submitWith(action)} className="space-y-6" aria-label={t.title}>
      <div>
        <Label htmlFor={id}>{t.note}</Label>
        <Input id={id} name="note" maxLength={120} autoComplete="off" className="mt-2 max-w-md" />
        <FieldHint>{t.noteHint}</FieldHint>
      </div>
      {state.problem ? <FieldError>{state.problem}</FieldError> : null}
      <Button type="submit" disabled={!hydrated || pending}>
        {pending ? t.making : t.make}
      </Button>
    </form>
  );
}
