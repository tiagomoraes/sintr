"use client";

import { Button, FieldError, Input, Label } from "@sintr/ui";
import { useActionState, useId } from "react";
import type { CodeState } from "@/app/(app)/sharing/actions";
import { useHydrated } from "@/lib/use-hydrated";
import { submitWith } from "@/lib/use-form-action";

/** Type a code someone gave you; it opens the invite, where you see who it is from before anything else. */
export function CodeForm({
  open,
  label,
  button,
}: {
  open: (state: CodeState, form: FormData) => Promise<CodeState>;
  label: string;
  button: string;
}) {
  const hydrated = useHydrated();
  const [state, action, pending] = useActionState(open, { problem: null });
  const id = useId();
  return (
    <form onSubmit={submitWith(action)} aria-label={label}>
      <Label htmlFor={id}>{label}</Label>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Input
          id={id}
          name="code"
          autoComplete="off"
          spellCheck={false}
          placeholder="XXXX-XXXX-XXXX"
          className="max-w-[16rem] font-mono uppercase tracking-[0.06em]"
          aria-invalid={state.problem ? true : undefined}
        />
        <Button type="submit" variant="outline" size="sm" disabled={!hydrated || pending}>
          {button}
        </Button>
      </div>
      {state.problem ? <FieldError>{state.problem}</FieldError> : null}
    </form>
  );
}
