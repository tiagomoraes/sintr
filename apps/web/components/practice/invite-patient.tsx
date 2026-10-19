"use client";

import { Button, FieldError, FieldHint, Input, Label } from "@sintr/ui";
import { useActionState, useId, useState } from "react";
import type { PatientInviteState } from "@/app/(app)/practice/actions";
import { InvitePanel } from "@/components/sharing/invite-panel";
import { useHydrated } from "@/lib/use-hydrated";
import { submitWith } from "@/lib/use-form-action";

function validUntil(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
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
        validUntil={validUntil(made.expiresAt, timezone)}
        note={made.note}
        footer={
          <>
            <p className="mt-2 text-[0.9375rem] text-ink-3">
              Read them the code in a session, or send the link the way you usually talk. It holds one seat
              until it is accepted, cancelled or expires.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-5"
              onClick={() => setHidden(made.id)}
            >
              Make another invite
            </Button>
          </>
        }
      />
    );
  }

  return (
    <form onSubmit={submitWith(action)} className="space-y-6" aria-label="Invite a patient">
      <div>
        <Label htmlFor={id}>Who it is for</Label>
        <Input id={id} name="note" maxLength={120} autoComplete="off" className="mt-2 max-w-md" />
        <FieldHint>Optional, and only for you: the person never sees it.</FieldHint>
      </div>
      {state.problem ? <FieldError>{state.problem}</FieldError> : null}
      <Button type="submit" disabled={!hydrated || pending}>
        {pending ? "Making the invite" : "Make an invite"}
      </Button>
    </form>
  );
}
