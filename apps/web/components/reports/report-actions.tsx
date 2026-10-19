"use client";

import type { ReportStatus } from "@sintr/core";
import { Button, Checkbox, FieldError, buttonVariants } from "@sintr/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { useMessages } from "@/components/language";
import { namesInWords } from "@/lib/reports";
import type { Messages } from "@/messages";

type Words = Messages["reports"];

/** What went wrong, by the code the server answered. */
function failureFor(code: string | undefined, failures: Words["failures"]): string {
  switch (code) {
    case "pdf_unavailable":
      return failures.pdfUnavailable;
    case "practice_changed":
      return failures.practiceChanged;
    case "sharing_changed":
      return failures.sharingChanged;
    case "not_found":
      return failures.notFound;
    case "email_off":
      return failures.emailOff;
    case "send_failed":
      return failures.sendFailed;
    case "invalid":
      return failures.invalid;
    case "invalid_state":
      return failures.invalidState;
    case "invalid_message":
      return failures.invalidMessage;
    default:
      return failures.other;
  }
}

async function post(
  id: string,
  body: Record<string, unknown>,
  failures: Words["failures"],
): Promise<string | null> {
  const response = await fetch(`/api/reports/${id}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const answer = (await response.json().catch(() => ({ code: "failed" }))) as {
    code?: string;
    failed?: string[];
  };
  if (response.ok) return answer.failed?.length ? failures.notShared : null;
  return failureFor(answer.code, failures);
}

/** A practice the person is linked with, as this report concerns it. */
export interface PracticeChoice {
  linkId: string;
  /** "Dr. Marina Costa (Clínica Horizonte)". */
  who: string;
  /** "Dr. Marina Costa". */
  name: string;
  /** The practice as the consent will record it (`practiceLine`), sent back with the yes. */
  line: string;
  /** Everything approved goes to them. */
  automatic: boolean;
  /** "Shared with them on 20 October. They opened it on 20 October.", or null when not shared. */
  shared: string | null;
}

function names(practices: readonly PracticeChoice[], words: Words): string {
  return namesInWords(
    practices.map((p) => p.name),
    words,
  );
}

/** Share an approved report with one practice: an explicit yes that names it, like an email send. */
function SharePanel({
  practice,
  busy,
  onShare,
}: {
  practice: PracticeChoice;
  busy: string | null;
  onShare: () => void;
}) {
  const { share } = useMessages().reports.actions;
  const [confirmed, setConfirmed] = useState(false);
  const id = useId();
  return (
    <div className="rounded-file border border-rule px-[22px] py-5">
      <p className="font-serif text-title-small text-ink">{share.title(practice.name)}</p>
      <div className="mt-4 flex items-start gap-3">
        <Checkbox id={id} checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
        <label htmlFor={id} className="text-[0.9688rem] leading-[1.55] text-ink-2">
          {share.consent[0]}
          <span className="font-medium text-ink">{practice.who}</span>
          {share.consent[1]}
        </label>
      </div>
      <div className="mt-5">
        <Button type="button" disabled={!confirmed || busy !== null} onClick={onShare}>
          {busy === `share-${practice.linkId}` ? share.busy : share.button(practice.name)}
        </Button>
      </div>
      <p className="mt-4 text-caption text-ink-3">{share.note}</p>
    </div>
  );
}

/**
 * The person's decisions on a report. Approving fixes the words and prints
 * the final PDF; sending is a second, explicit yes that names the address,
 * and so is sharing with a linked practice. Approving shares on its own only
 * with practices the person chose to receive what they approve, named on
 * the button. Nothing here sends on its own.
 */
export function ReportActions({
  id,
  status,
  edited,
  shared,
  delivery,
  practices = [],
}: {
  id: string;
  status: ReportStatus;
  edited: boolean;
  /** Shared with a practice: the words are final. */
  shared: boolean;
  /** Where an approved report can go, or why it cannot. */
  delivery:
    | { kind: "email"; therapist: string | null; email: string }
    | { kind: "keep" }
    | { kind: "no_address" }
    | { kind: "email_off" };
  /** The practices the person is actively linked with. */
  practices?: readonly PracticeChoice[];
}) {
  const words = useMessages().reports;
  const { actions } = words;
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const confirmId = useId();

  const act = async (name: string, body: Record<string, unknown>) => {
    setBusy(name);
    setFailure(null);
    const problem = await post(id, body, words.failures);
    setBusy(null);
    if (problem) setFailure(problem);
    else router.refresh();
  };

  const automatic = practices.filter((practice) => practice.automatic);
  const sendConsent = actions.send.consent(delivery.kind === "email" ? delivery.therapist : null);
  const changeWords = shared ? null : (
    <Link href={`/reports/${id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
      {actions.change}
    </Link>
  );
  const practicePanels =
    status !== "draft" && practices.length ? (
      <div className="space-y-4">
        {practices.map((practice) =>
          practice.shared ? (
            <p key={practice.linkId} className="max-w-[38em] text-[0.9688rem] text-ink-2" role="status">
              {practice.shared}
            </p>
          ) : (
            <SharePanel
              key={practice.linkId}
              practice={practice}
              busy={busy}
              onShare={() =>
                void act(`share-${practice.linkId}`, {
                  action: "share",
                  linkId: practice.linkId,
                  shown: practice.line,
                  confirmed: true,
                })
              }
            />
          ),
        )}
      </div>
    ) : null;

  if (status === "sent") {
    return practicePanels ? (
      <div className="space-y-6">
        {practicePanels}
        {failure ? <FieldError>{failure}</FieldError> : null}
      </div>
    ) : null;
  }

  return (
    <div className="space-y-6">
      {status === "draft" ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <Button
            type="button"
            onClick={() =>
              void act("approve", { action: "approve", share: automatic.map((practice) => practice.linkId) })
            }
            disabled={busy !== null}
          >
            {busy === "approve"
              ? actions.approving
              : automatic.length
                ? actions.approveAndShare(names(automatic, words))
                : actions.approve}
          </Button>
          <Link href={`/reports/${id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            {actions.change}
          </Link>
          <Button
            type="button"
            variant="quiet"
            size="sm"
            onClick={() => void act("again", { action: "prepare_again" })}
            disabled={busy !== null}
          >
            {busy === "again" ? actions.preparing : actions.again}
          </Button>
        </div>
      ) : null}
      {status === "draft" ? (
        <p className="max-w-[38em] text-[0.9375rem] text-ink-3">
          {actions.approveNote}{" "}
          {automatic.length
            ? actions.approveShares(names(automatic, words), automatic.length)
            : actions.approveSendsNothing}
          {edited ? ` ${actions.againReplaces}` : ""}
        </p>
      ) : null}
      {practicePanels}

      {status === "reviewed" ? (
        delivery.kind === "email" ? (
          <div className="rounded-file border border-rule px-[22px] py-5">
            <p className="font-serif text-title-small text-ink">{actions.send.title}</p>
            <div className="mt-4 flex items-start gap-3">
              <Checkbox
                id={confirmId}
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              <label htmlFor={confirmId} className="text-[0.9688rem] leading-[1.55] text-ink-2">
                {sendConsent[0]}
                <span className="font-medium text-ink">{delivery.email}</span>
                {sendConsent[1]}
              </label>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Button
                type="button"
                disabled={!confirmed || busy !== null}
                onClick={() =>
                  void act("send", { action: "send", recipient: delivery.email, confirmed: true })
                }
              >
                {busy === "send" ? actions.send.busy : actions.send.button}
              </Button>
              {changeWords}
            </div>
            <p className="mt-4 text-caption text-ink-3">{actions.send.note}</p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <p className="max-w-[36em] text-[0.9688rem] text-ink-2">
              {delivery.kind === "keep"
                ? practices.length
                  ? actions.keepWithPractices
                  : actions.keep
                : delivery.kind === "no_address"
                  ? actions.noAddress
                  : actions.emailOff}
            </p>
            {changeWords}
          </div>
        )
      ) : null}
      {failure ? <FieldError>{failure}</FieldError> : null}
    </div>
  );
}
