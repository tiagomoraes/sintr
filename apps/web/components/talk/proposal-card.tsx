"use client";

import { Button, FieldError, NotebookCard, NotebookFoot, NotebookHead, linkStyles } from "@sintr/ui";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CheckinFields } from "@/components/ledger/checkin-fields";
import { CheckinValues, type CheckinView } from "@/components/ledger/checkin-values";
import { EntryFields } from "@/components/ledger/entry-fields";
import { EntryRows, type EntryView } from "@/components/ledger/entry-rows";
import { checkinFromForm, entryFromForm, isEmptyCheckin, type FormProblems } from "@/lib/forms";
import { formatMoment } from "@/lib/format";
import type { ProposalView } from "@/lib/proposals";

type Draft = (EntryView & CheckinView & { occurredAt?: string | null }) | Record<string, unknown>;

interface Props {
  proposalId: string;
  kind: "entry" | "checkin";
  /** What the assistant drafted (the tool's checked output). */
  draft: Draft;
  view: ProposalView | undefined;
  onView: (view: ProposalView) => void;
  locale: { language: string; timezone: string };
}

const STATUS_TAG = { proposed: "Draft, not saved", saved: "Saved", discarded: "Discarded" } as const;

/** Where keyboard focus goes after the card changes, so it is never lost. */
type FocusTarget = "form" | "edit" | "discard" | "discardIt" | "result" | null;

/**
 * A draft from the conversation, for the person to review. Nothing in it is
 * a record until they press Confirm (or say "salva"). Edit lets them fix any
 * field first; Discard asks once more, then keeps nothing.
 */
export function ProposalCard({ proposalId, kind, draft, view, onView, locale }: Props) {
  const [mode, setMode] = useState<"view" | "edit" | "discard">("view");
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<FormProblems>({});
  const [failure, setFailure] = useState<string | null>(null);
  // Read after the next render, once the element to focus exists.
  const focusNext = useRef<FocusTarget>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  const discardRef = useRef<HTMLButtonElement>(null);
  const discardItRef = useRef<HTMLButtonElement>(null);
  const resultRef = useRef<HTMLParagraphElement>(null);

  const status = view?.status ?? "proposed";
  // A draft decided elsewhere (for example by "salva") leaves edit mode.
  const editing = mode === "edit" && status === "proposed";
  const askingToDiscard = mode === "discard" && status === "proposed";
  // Once saved with changes, the card shows what was saved.
  const shown = (view?.edited && view.payload ? view.payload : draft) as EntryView &
    CheckinView & { occurredAt?: string };
  const noun = kind === "entry" ? "entry" : "check-in";
  const recordHref = view?.recordId ? `/${kind === "entry" ? "entries" : "checkins"}/${view.recordId}` : null;
  const moment = shown.occurredAt ? formatMoment(new Date(shown.occurredAt), locale) : null;

  useEffect(() => {
    const wanted = focusNext.current;
    if (!wanted) return;
    focusNext.current = null;
    const target = {
      form: formRef.current?.querySelector<HTMLElement>("input, textarea"),
      edit: editRef.current,
      discard: discardRef.current,
      discardIt: discardItRef.current,
      result: resultRef.current,
    }[wanted];
    target?.focus();
  });

  function show(next: "view" | "edit" | "discard", focus: FocusTarget) {
    focusNext.current = focus;
    setMode(next);
  }

  async function decide(body: Record<string, unknown>) {
    setBusy(true);
    setFailure(null);
    try {
      const response = await fetch(`/api/proposals/${proposalId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json().catch(() => null)) as
        (ProposalView & { code?: string; proposal?: ProposalView; fields?: string[] }) | null;
      if (response.ok && result) {
        onView(result);
        show("view", "result");
      } else if (response.status === 409 && result?.proposal) {
        onView(result.proposal);
        show("view", "result");
      } else if (response.status === 400 && result?.code === "invalid") {
        setFailure("Some of it could not be kept as it is. Check the fields and try again.");
      } else {
        setFailure("This could not be saved just now. Nothing was lost; try again in a moment.");
      }
    } catch {
      setFailure("This could not be saved just now. Nothing was lost; try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  function saveEdits(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (kind === "entry") {
      const parsed = entryFromForm(form, locale.timezone);
      if (!parsed.ok) return setProblems(parsed.problems);
      setProblems({});
      void decide({ action: "confirm", values: parsed.values });
    } else {
      const parsed = checkinFromForm(form, locale.timezone);
      if (!parsed.ok) return setProblems(parsed.problems);
      if (isEmptyCheckin(parsed.values)) {
        return setProblems({ mood: "Give at least one value, or discard the draft." });
      }
      setProblems({});
      void decide({ action: "confirm", values: parsed.values });
    }
  }

  if (status === "discarded") {
    return (
      <p
        ref={resultRef}
        tabIndex={-1}
        role="status"
        className="rounded-file border border-rule px-5 py-3.5 text-[0.9375rem] text-ink-3"
      >
        <span className="font-serif italic">Draft discarded.</span> Nothing from it was saved.
      </p>
    );
  }

  return (
    <NotebookCard
      aria-label={status === "saved" ? `Saved ${noun}` : `Draft ${noun}, waiting for you`}
      className={status === "saved" ? "shadow-none" : undefined}
    >
      <NotebookHead
        time={
          moment ??
          (status === "saved"
            ? "Kept in your diary"
            : kind === "entry"
              ? "A draft for your diary"
              : "A check-in for today")
        }
        tag={STATUS_TAG[status]}
      />
      {editing ? (
        <form ref={formRef} onSubmit={saveEdits} className="py-6 pl-11 pr-5" aria-label={`Edit this ${noun}`}>
          {kind === "entry" ? (
            <EntryFields defaults={shown} timezone={locale.timezone} problems={problems} />
          ) : (
            <CheckinFields defaults={shown} timezone={locale.timezone} problems={problems} />
          )}
          {failure ? <FieldError>{failure}</FieldError> : null}
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button type="submit" disabled={busy}>
              Save {noun}
            </Button>
            <Button
              type="button"
              variant="quiet"
              size="inline"
              onClick={() => show("view", "edit")}
              disabled={busy}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : kind === "entry" ? (
        <EntryRows entry={shown} />
      ) : (
        <CheckinValues checkin={shown} />
      )}
      {editing ? null : status === "saved" ? (
        <NotebookFoot>
          <p ref={resultRef} tabIndex={-1} role="status" className="text-[0.9375rem] text-ink-2">
            {view?.edited
              ? `Saved with your changes.`
              : `Saved to your ${kind === "entry" ? "entries" : "check-ins"}.`}{" "}
            {recordHref ? (
              <Link href={recordHref} className={linkStyles}>
                Open it
              </Link>
            ) : null}
          </p>
        </NotebookFoot>
      ) : askingToDiscard ? (
        <NotebookFoot>
          <p className="w-full text-[0.9375rem] text-ink-2">
            Discard this draft? Nothing from it will be saved.
          </p>
          <Button
            ref={discardItRef}
            size="sm"
            onClick={() => void decide({ action: "discard" })}
            disabled={busy}
          >
            Discard it
          </Button>
          <Button variant="quiet" size="inline" onClick={() => show("view", "discard")} disabled={busy}>
            Keep it
          </Button>
        </NotebookFoot>
      ) : (
        <NotebookFoot>
          <Button size="sm" onClick={() => void decide({ action: "confirm" })} disabled={busy}>
            Confirm
          </Button>
          <Button
            ref={editRef}
            variant="outline"
            size="sm"
            onClick={() => show("edit", "form")}
            disabled={busy}
          >
            Edit
          </Button>
          <Button
            ref={discardRef}
            variant="quiet"
            size="inline"
            onClick={() => show("discard", "discardIt")}
            disabled={busy}
          >
            Discard
          </Button>
          {failure ? <FieldError className="mt-0 w-full">{failure}</FieldError> : null}
        </NotebookFoot>
      )}
    </NotebookCard>
  );
}
