"use client";

import { Button, FieldError, FieldHint, Input, Label } from "@sintr/ui";
import { useActionState, useId } from "react";
import type { TherapistInviteState } from "@/app/(app)/sharing/actions";
import { useHydrated } from "@/lib/use-hydrated";
import { submitWith } from "@/lib/use-form-action";
import { InvitePanel } from "./invite-panel";

function validUntil(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
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
  const hydrated = useHydrated();
  const [state, action, pending] = useActionState(invite, { invite: null, problem: null });
  const id = useId();

  if (state.invite) {
    return (
      <div>
        <InvitePanel
          code={state.invite.code}
          link={state.invite.link}
          validUntil={validUntil(state.invite.expiresAt, timezone)}
          footer={
            <p className="mt-2 text-[0.9375rem] text-ink-3">
              Send it to your therapist the way you usually talk to them. When they accept it in their
              practice on sintr, you will see it in Sharing and confirm it is them. Nothing is shared before
              that.
            </p>
          }
        />
      </div>
    );
  }

  return (
    <form onSubmit={submitWith(action)} className="space-y-6" aria-label="Invite your therapist">
      <div>
        <Label htmlFor={id}>How they will see you</Label>
        <Input
          id={id}
          name="personName"
          defaultValue={defaultName}
          maxLength={80}
          className="mt-2 max-w-md"
        />
        <FieldHint>Optional. The name your therapist knows you by; you can change it later.</FieldHint>
      </div>
      {state.problem ? <FieldError>{state.problem}</FieldError> : null}
      <Button type="submit" disabled={!hydrated || pending}>
        {pending ? "Making the invite" : "Make an invite for my therapist"}
      </Button>
    </form>
  );
}
