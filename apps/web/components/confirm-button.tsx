"use client";

import { Button } from "@sintr/ui";
import { useState, useTransition, type ReactNode } from "react";

/**
 * A decision that cannot be taken back, in two steps: the first press says
 * what will happen, the second does it. Nothing happens on the first press.
 */
export function ConfirmButton({
  label,
  confirmLabel,
  keepLabel = "Keep it",
  pendingLabel,
  explanation,
  action,
  ariaLabel,
}: {
  label: string;
  confirmLabel: string;
  keepLabel?: string;
  pendingLabel: string;
  explanation: ReactNode;
  action: () => Promise<void>;
  ariaLabel?: string;
}) {
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
          {keepLabel}
        </Button>
      </div>
    </div>
  );
}
