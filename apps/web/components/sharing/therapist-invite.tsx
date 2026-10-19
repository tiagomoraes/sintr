"use client";

import { Button, FieldError, FieldHint, Input, Label } from "@sintr/ui";
import { useActionState, useId } from "react";
import type { TherapistInviteState } from "@/app/(app)/sharing/actions";
import { useLanguage, useMessages } from "@/components/language";
import { useHydrated } from "@/lib/use-hydrated";
import { submitWith } from "@/lib/use-form-action";
import { InvitePanel } from "./invite-panel";

function validUntil(iso: string, timezone: string, intl: string): string {
  return new Intl.DateTimeFormat(intl, {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
}

/** "Invite your therapist": an optional name, one button, then the code and link to send them. */
export function TherapistInvite({
  invite,
  timezone,
  defaultName,
}: {
  invite: (state: TherapistInviteState, form: FormData) => Promise<TherapistInviteState>;
  timezone: string;
  defaultName: string;
}) {
  const t = useMessages().sharing.invite;
  const { intl } = useLanguage();
  const hydrated = useHydrated();
  const [state, action, pending] = useActionState(invite, { invite: null, problem: null });
  const id = useId();

  if (state.invite) {
    return (
      <div>
        <InvitePanel
          code={state.invite.code}
          link={state.invite.link}
          validUntil={validUntil(state.invite.expiresAt, timezone, intl)}
          footer={<p className="mt-2 text-[0.9375rem] text-ink-3">{t.made}</p>}
        />
      </div>
    );
  }

  return (
    <form onSubmit={submitWith(action)} className="space-y-6" aria-label={t.title}>
      <div>
        <Label htmlFor={id}>{t.name}</Label>
        <Input
          id={id}
          name="personName"
          defaultValue={defaultName}
          maxLength={80}
          className="mt-2 max-w-md"
        />
        <FieldHint>{t.nameHint}</FieldHint>
      </div>
      {state.problem ? <FieldError>{state.problem}</FieldError> : null}
      <Button type="submit" disabled={!hydrated || pending}>
        {pending ? t.making : t.make}
      </Button>
    </form>
  );
}
