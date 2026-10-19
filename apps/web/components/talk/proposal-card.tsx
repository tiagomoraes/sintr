"use client";

import { Button, FieldError, NotebookCard, NotebookFoot, NotebookHead, linkStyles } from "@sintr/ui";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CheckinFields } from "@/components/ledger/checkin-fields";
import { CheckinValues, type CheckinView } from "@/components/ledger/checkin-values";
import { EntryFields } from "@/components/ledger/entry-fields";
import { EntryRows, type EntryView } from "@/components/ledger/entry-rows";
import { useMessages } from "@/components/language";
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

/** Where keyboard focus goes after the card changes, so it is never lost. */
type FocusTarget = "form" | "edit" | "discard" | "discardIt" | "result" | null;

/**
 * A draft from the conversation, for the person to review. Nothing in it is
 * a record until they press Confirm (or say "salva"). Edit lets them fix any
 * field first; Discard asks once more, then keeps nothing.
 */
export function ProposalCard({ proposalId, kind, draft, view, onView, locale }: Props) {
  const t = useMessages();
  const card = t.entry.card;
  // What differs by kind: the card's name, its head, its buttons, its problems.
  const words = kind === "entry" ? t.entry.draft : t.checkin.draft;
  const problemsOf = kind === "entry" ? t.entry.problems : t.checkin.problems;
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
        setFailure(problemsOf.invalid);
      } else {
        setFailure(card.unavailable);
      }
    } catch {
      setFailure(card.unavailable);
    } finally {
      setBusy(false);
    }
  }

  function saveEdits(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (kind === "entry") {
      const parsed = entryFromForm(form, locale.timezone, t.entry.problems);
      if (!parsed.ok) return setProblems(parsed.problems);
      setProblems({});
      void decide({ action: "confirm", values: parsed.values });
    } else {
      const parsed = checkinFromForm(form, locale.timezone, t.checkin.problems);
      if (!parsed.ok) return setProblems(parsed.problems);
      if (isEmptyCheckin(parsed.values)) {
        return setProblems({ mood: t.checkin.problems.emptyDraft });
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
        <span className="font-serif italic">{card.discarded}</span> {card.nothingSaved}
      </p>
    );
  }

  return (
    <NotebookCard
      aria-label={status === "saved" ? words.saved : words.label}
      className={status === "saved" ? "shadow-none" : undefined}
    >
      <NotebookHead
        time={moment ?? (status === "saved" ? card.kept : words.head)}
        tag={card.status[status]}
      />
      {editing ? (
        <form ref={formRef} onSubmit={saveEdits} className="py-6 pl-11 pr-5" aria-label={words.edit}>
          {kind === "entry" ? (
            <EntryFields defaults={shown} timezone={locale.timezone} problems={problems} />
          ) : (
            <CheckinFields defaults={shown} timezone={locale.timezone} problems={problems} />
          )}
          {failure ? <FieldError>{failure}</FieldError> : null}
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button type="submit" disabled={busy}>
              {words.save}
            </Button>
            <Button
              type="button"
              variant="quiet"
              size="inline"
              onClick={() => show("view", "edit")}
              disabled={busy}
            >
              {card.cancel}
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
            {view?.edited ? card.savedEdited : words.savedTo}{" "}
            {recordHref ? (
              <Link href={recordHref} className={linkStyles}>
                {card.open}
              </Link>
            ) : null}
          </p>
        </NotebookFoot>
      ) : askingToDiscard ? (
        <NotebookFoot>
          <p className="w-full text-[0.9375rem] text-ink-2">{card.discardAsk}</p>
          <Button
            ref={discardItRef}
            size="sm"
            onClick={() => void decide({ action: "discard" })}
            disabled={busy}
          >
            {card.discardIt}
          </Button>
          <Button variant="quiet" size="inline" onClick={() => show("view", "discard")} disabled={busy}>
            {card.keepIt}
          </Button>
        </NotebookFoot>
      ) : (
        <NotebookFoot>
          <Button size="sm" onClick={() => void decide({ action: "confirm" })} disabled={busy}>
            {card.confirm}
          </Button>
          <Button
            ref={editRef}
            variant="outline"
            size="sm"
            onClick={() => show("edit", "form")}
            disabled={busy}
          >
            {card.edit}
          </Button>
          <Button
            ref={discardRef}
            variant="quiet"
            size="inline"
            onClick={() => show("discard", "discardIt")}
            disabled={busy}
          >
            {card.discard}
          </Button>
          {failure ? <FieldError className="mt-0 w-full">{failure}</FieldError> : null}
        </NotebookFoot>
      )}
    </NotebookCard>
  );
}
