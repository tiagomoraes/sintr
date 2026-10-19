"use client";

import type { ReportStatus } from "@sintr/core";
import { Button, Checkbox, FieldError, buttonVariants } from "@sintr/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

const FAILURES: Record<string, string> = {
  pdf_unavailable: "The PDF could not be printed just now. Nothing changed; try again in a moment.",
  practice_changed:
    "The practice changed its name or details since this page opened. Nothing was shared; reload the page and read them again.",
  sharing_changed:
    "Who receives what you approve changed since this page opened. Nothing was approved; reload the page and look again.",
  not_found: "That link is no longer active, so nothing was shared. Reload the page.",
  email_off: "Email is not set up on this sintr, so nothing was sent. Download the PDF to share it yourself.",
  send_failed: "The email could not be sent, so the report is not marked sent. Try again in a moment.",
  invalid: "Your therapist's email changed since this page opened. Read the address again before sending.",
  invalid_state: "The report changed since this page opened. Reload it and look again.",
  invalid_message: "Your therapist's email does not look right. Check it in Therapy.",
};

async function post(id: string, body: Record<string, unknown>): Promise<string | null> {
  const response = await fetch(`/api/reports/${id}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const answer = (await response.json().catch(() => ({ code: "failed" }))) as {
    code?: string;
    failed?: string[];
  };
  if (response.ok) {
    return answer.failed?.length
      ? "Approved. It could not be shared with every practice just now; share it from below."
      : null;
  }
  return FAILURES[answer.code ?? ""] ?? "Something went wrong. Nothing was sent. Try again in a moment.";
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

function names(practices: readonly PracticeChoice[]): string {
  const all = practices.map((p) => p.name);
  return all.length <= 1 ? (all[0] ?? "") : `${all.slice(0, -1).join(", ")} and ${all.at(-1)}`;
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
  const [confirmed, setConfirmed] = useState(false);
  const id = useId();
  return (
    <div className="rounded-file border border-rule px-[22px] py-5">
      <p className="font-serif text-title-small text-ink">Share it with {practice.name}</p>
      <div className="mt-4 flex items-start gap-3">
        <Checkbox id={id} checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
        <label htmlFor={id} className="text-[0.9688rem] leading-[1.55] text-ink-2">
          I approve sharing this report, exactly as in the PDF below, with{" "}
          <span className="font-medium text-ink">{practice.who}</span> on sintr.
        </label>
      </div>
      <div className="mt-5">
        <Button type="button" disabled={!confirmed || busy !== null} onClick={onShare}>
          {busy === `share-${practice.linkId}` ? "Sharing" : `Share with ${practice.name}`}
        </Button>
      </div>
      <p className="mt-4 text-caption text-ink-3">
        They read it in their practice and can download the PDF. Your yes is recorded with the date. You can
        stop sharing in Sharing; a PDF they downloaded stays with them.
      </p>
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
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const confirmId = useId();

  const act = async (name: string, body: Record<string, unknown>) => {
    setBusy(name);
    setFailure(null);
    const problem = await post(id, body);
    setBusy(null);
    if (problem) setFailure(problem);
    else router.refresh();
  };

  const automatic = practices.filter((practice) => practice.automatic);
  const changeWords = shared ? null : (
    <Link href={`/reports/${id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
      Change the words
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
              ? "Approving"
              : automatic.length
                ? `Approve and share with ${names(automatic)}`
                : "Approve this report"}
          </Button>
          <Link href={`/reports/${id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Change the words
          </Link>
          <Button
            type="button"
            variant="quiet"
            size="sm"
            onClick={() => void act("again", { action: "prepare_again" })}
            disabled={busy !== null}
          >
            {busy === "again" ? "Preparing" : "Prepare it again"}
          </Button>
        </div>
      ) : null}
      {status === "draft" ? (
        <p className="max-w-[38em] text-[0.9375rem] text-ink-3">
          Approving keeps this version and prints the final PDF, without the draft mark.{" "}
          {automatic.length
            ? `You chose that what you approve goes to ${names(automatic)}, so approving also shares it with ${
                automatic.length === 1 ? "them" : "each of them"
              }, and nothing else.`
            : "Nothing is sent when you approve."}
          {edited ? " Preparing it again replaces your changes; what they said is kept below." : ""}
        </p>
      ) : null}
      {practicePanels}

      {status === "reviewed" ? (
        delivery.kind === "email" ? (
          <div className="rounded-file border border-rule px-[22px] py-5">
            <p className="font-serif text-title-small text-ink">Send it to your therapist</p>
            <div className="mt-4 flex items-start gap-3">
              <Checkbox
                id={confirmId}
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              <label htmlFor={confirmId} className="text-[0.9688rem] leading-[1.55] text-ink-2">
                I approve sending this report, exactly as in the PDF below, to{" "}
                {delivery.therapist ? `${delivery.therapist}, ` : ""}
                <span className="font-medium text-ink">{delivery.email}</span>.
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
                {busy === "send" ? "Sending" : "Approve and send"}
              </Button>
              {changeWords}
            </div>
            <p className="mt-4 text-caption text-ink-3">
              An email cannot be taken back. Your yes is recorded with the date, the report and the address.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <p className="max-w-[36em] text-[0.9688rem] text-ink-2">
              {delivery.kind === "keep"
                ? practices.length
                  ? "Nothing goes by email: you chose to keep the PDF for yourself. You can download it below."
                  : "You chose to keep reports for yourself. Download the PDF to bring it or share it your way."
                : delivery.kind === "no_address"
                  ? "To send it, add your therapist's email in Therapy. You can also download the PDF and share it yourself."
                  : "Email is not set up on this sintr. Download the PDF to bring it or share it yourself."}
            </p>
            {changeWords}
          </div>
        )
      ) : null}
      {failure ? <FieldError>{failure}</FieldError> : null}
    </div>
  );
}
