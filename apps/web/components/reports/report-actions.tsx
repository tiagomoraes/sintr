"use client";

import type { ReportStatus } from "@sintr/core";
import { Button, Checkbox, FieldError, buttonVariants } from "@sintr/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

const FAILURES: Record<string, string> = {
  pdf_unavailable: "The PDF could not be printed just now. Nothing changed; try again in a moment.",
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
  if (response.ok) return null;
  const { code } = (await response.json().catch(() => ({ code: "failed" }))) as { code?: string };
  return FAILURES[code ?? ""] ?? "Something went wrong. Nothing was sent. Try again in a moment.";
}

/**
 * The person's decisions on a report. Approving fixes the words and prints
 * the final PDF; sending is a second, explicit yes that names the address.
 * Nothing here sends on its own.
 */
export function ReportActions({
  id,
  status,
  edited,
  delivery,
}: {
  id: string;
  status: ReportStatus;
  edited: boolean;
  /** Where an approved report can go, or why it cannot. */
  delivery:
    | { kind: "email"; therapist: string | null; email: string }
    | { kind: "keep" }
    | { kind: "no_address" }
    | { kind: "email_off" };
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

  if (status === "sent") return null;

  return (
    <div className="space-y-6">
      {status === "draft" ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <Button
            type="button"
            onClick={() => void act("approve", { action: "approve" })}
            disabled={busy !== null}
          >
            {busy === "approve" ? "Approving" : "Approve this report"}
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
          Approving keeps this version and prints the final PDF, without the draft mark. Nothing is sent when
          you approve.
          {edited ? " Preparing it again replaces your changes; what they said is kept below." : ""}
        </p>
      ) : null}

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
              <Link
                href={`/reports/${id}/edit`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Change the words
              </Link>
            </div>
            <p className="mt-4 text-caption text-ink-3">
              An email cannot be taken back. Your yes is recorded with the date, the report and the address.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <p className="max-w-[36em] text-[0.9688rem] text-ink-2">
              {delivery.kind === "keep"
                ? "You chose to keep reports for yourself. Download the PDF to bring it or share it your way."
                : delivery.kind === "no_address"
                  ? "To send it, add your therapist's email in Therapy. You can also download the PDF and share it yourself."
                  : "Email is not set up on this sintr. Download the PDF to bring it or share it yourself."}
            </p>
            <Link href={`/reports/${id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Change the words
            </Link>
          </div>
        )
      ) : null}
      {failure ? <FieldError>{failure}</FieldError> : null}
    </div>
  );
}
