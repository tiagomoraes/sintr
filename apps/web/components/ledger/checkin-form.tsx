"use client";

import { Button, FieldError, linkStyles } from "@sintr/ui";
import Link from "next/link";
import { useActionState } from "react";
import type { CheckinFormState } from "@/app/(app)/checkins/actions";
import { CheckinFields, type CheckinDefaults } from "./checkin-fields";

export function CheckinForm({
  action,
  defaults,
  timezone,
  submitLabel,
  cancelHref,
  correctionNote = false,
}: {
  action: (state: CheckinFormState, form: FormData) => Promise<CheckinFormState>;
  defaults?: CheckinDefaults;
  timezone: string;
  submitLabel: string;
  cancelHref: string;
  correctionNote?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, { problems: {}, failure: null });
  return (
    <form action={formAction} className="max-w-[44rem]">
      <CheckinFields
        {...(defaults ? { defaults } : {})}
        timezone={timezone}
        problems={state.problems}
        correctionNote={correctionNote}
      />
      {state.failure ? <FieldError>{state.failure}</FieldError> : null}
      <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-3">
        <Button type="submit" disabled={pending}>
          {submitLabel}
        </Button>
        <Link href={cancelHref} className={linkStyles}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
