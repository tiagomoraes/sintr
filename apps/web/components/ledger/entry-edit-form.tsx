"use client";

import { Button, FieldError, linkStyles } from "@sintr/ui";
import Link from "next/link";
import { useActionState } from "react";
import type { EntryFormState } from "@/app/(app)/entries/actions";
import { useMessages } from "@/components/language";
import { EntryFields, type EntryDefaults } from "./entry-fields";

export function EntryEditForm({
  action,
  defaults,
  timezone,
  cancelHref,
}: {
  action: (state: EntryFormState, form: FormData) => Promise<EntryFormState>;
  defaults: EntryDefaults;
  timezone: string;
  cancelHref: string;
}) {
  const E = useMessages().entry;
  const [state, formAction, pending] = useActionState(action, { problems: {}, failure: null });
  return (
    <form action={formAction} className="max-w-[44rem]">
      <EntryFields defaults={defaults} timezone={timezone} problems={state.problems} correctionNote />
      {state.failure ? <FieldError>{state.failure}</FieldError> : null}
      {Object.keys(state.problems).length > 0 ? <FieldError>{E.problems.review}</FieldError> : null}
      <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-3">
        <Button type="submit" disabled={pending}>
          {E.edit.save}
        </Button>
        <Link href={cancelHref} className={linkStyles}>
          {E.edit.cancel}
        </Link>
      </div>
    </form>
  );
}
