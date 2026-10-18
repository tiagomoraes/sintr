"use client";

import { startTransition, type FormEvent } from "react";

/**
 * Submit a form to a `useActionState` action without React's automatic form
 * reset, which would put controlled fields (selects, segmented radios) out of
 * step with their state.
 */
export function submitWith(action: (form: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(() => action(form));
  };
}
