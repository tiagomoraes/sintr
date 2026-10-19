"use client";

import { Button, FieldError, Label, Textarea, Verbatim, linkStyles } from "@sintr/ui";
import Link from "next/link";
import { useActionState, useEffect, useId, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { CorrectState } from "@/app/(app)/memory/actions";
import { ConfirmButton } from "@/components/confirm-button";
import { useMessages } from "@/components/language";

/** A submit button that says what it is doing while its form is sent. */
export function PendingButton({
  label,
  pending,
  variant = "ink",
}: {
  label: string;
  pending: string;
  variant?: "ink" | "outline";
}) {
  const status = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={variant} disabled={status.pending}>
      {status.pending ? pending : label}
    </Button>
  );
}

/** The person's own words for a memory, in a closed disclosure until they open it. */
function CorrectForm({
  text,
  correct,
}: {
  text: string;
  correct: (state: CorrectState, form: FormData) => Promise<CorrectState>;
}) {
  const M = useMessages().memory.correct;
  const details = useRef<HTMLDetailsElement>(null);
  const [state, action, saving] = useActionState(correct, { problem: null, done: false });
  const field = useId();
  useEffect(() => {
    if (state.done && details.current) details.current.open = false;
  }, [state]);
  return (
    <details ref={details} className="group open:w-full">
      <summary className="inline-flex min-h-10 cursor-pointer list-none items-center rounded-pill border border-rule bg-paper px-[18px] text-label font-medium text-ink-2 transition-colors duration-300 hover:border-rule-strong hover:text-ink [&::-webkit-details-marker]:hidden">
        {M.open}
      </summary>
      <form action={action} className="mt-4 max-w-[34em] space-y-3">
        <Label htmlFor={field}>{M.label}</Label>
        <Textarea
          id={field}
          name="text"
          rows={2}
          maxLength={300}
          defaultValue={text}
          aria-invalid={state.problem ? true : undefined}
        />
        {state.problem ? <FieldError>{state.problem}</FieldError> : null}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? M.saving : M.save}
          </Button>
          <Button
            type="button"
            variant="quiet"
            size="sm"
            onClick={() => {
              if (details.current) details.current.open = false;
            }}
          >
            {M.cancel}
          </Button>
        </div>
      </form>
    </details>
  );
}

/**
 * One memory: what sintr remembers, in its own sentence; the person's words
 * it rests on, under the highlighter (they are a quotation of the person);
 * where it came from; and the two things the person can do with it.
 */
export function MemoryItem({
  text,
  quote,
  source,
  correct,
  forget,
}: {
  text: ReactNode;
  quote: string | null;
  /** Where it came from, already worded: a link to the page, and whether the person corrected it. */
  source: { label: string; href: string | null; corrected: boolean; extra?: ReactNode };
  /** Absent for the name, which is changed in the welcome. */
  correct?: { text: string; action: (state: CorrectState, form: FormData) => Promise<CorrectState> };
  forget: () => Promise<void>;
}) {
  const M = useMessages().memory;
  return (
    <li className="group/memory border-b border-rule py-6 last:border-b-0">
      <p className="max-w-[36em] font-serif text-[1.1875rem] leading-[1.45] text-ink">{text}</p>
      {quote ? (
        <p className="mt-2 max-w-[36em] font-serif text-[1rem] leading-[1.5] text-ink-2">
          <span className="sr-only">{M.words}: </span>
          <Verbatim>{quote}</Verbatim>
        </p>
      ) : null}
      <p className="mt-2 text-caption text-ink-3">
        {source.href ? (
          <Link href={source.href} className={linkStyles}>
            {source.label}
          </Link>
        ) : (
          source.label
        )}
        {source.extra ? <> {source.extra}</> : null}
        {source.corrected ? `. ${M.corrected}` : null}
      </p>
      <div className="mt-4 flex flex-wrap items-start gap-x-4 gap-y-3">
        {correct ? <CorrectForm text={correct.text} correct={correct.action} /> : null}
        {/* While the person corrects it, the form is the only thing in the row. */}
        <div className="group-has-[details[open]]/memory:hidden">
          <ConfirmButton
            label={M.forget.label}
            confirmLabel={M.forget.confirm}
            pendingLabel={M.forget.pending}
            explanation={M.forget.explanation}
            action={forget}
          />
        </div>
      </div>
    </li>
  );
}
