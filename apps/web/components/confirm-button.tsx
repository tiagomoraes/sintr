"use client";

import { Button } from "@sintr/ui";
import { useState, useTransition, type ReactNode } from "react";
import { useMessages } from "@/components/language";

/**
 * A decision that cannot be taken back, in two steps: the first press says
 * what will happen, the second does it. Nothing happens on the first press.
 */
export function ConfirmButton({
  label,
  confirmLabel,
  keepLabel,
  pendingLabel,
  explanation,
  action,
  ariaLabel,
}: {
  label: string;
  confirmLabel: string;
  /** The page language's "Keep it" (`common.keep`) unless said otherwise. */
  keepLabel?: string;
  pendingLabel: string;
  explanation: ReactNode;
  action: () => Promise<void>;
  ariaLabel?: string;
}) {
  const t = useMessages();
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();
  if (!asking) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={ariaLabel}
        onClick={() => setAsking(true)}
      >
        {label}
      </Button>
    );
  }
  return (
    <div
      role="group"
      aria-label={ariaLabel ?? label}
      className="max-w-[34em] rounded-file border border-ink px-5 py-4"
    >
      <p className="text-[0.9375rem] text-ink">{explanation}</p>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
        <Button type="button" size="sm" disabled={pending} onClick={() => start(() => action())}>
          {pending ? pendingLabel : confirmLabel}
        </Button>
        <Button type="button" variant="quiet" size="sm" disabled={pending} onClick={() => setAsking(false)}>
          {keepLabel ?? t.common.keep}
        </Button>
      </div>
    </div>
  );
}
