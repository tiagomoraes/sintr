"use client";

import { Button } from "@sintr/ui";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

/** The account's address and whether it is confirmed; a new link on request. */
export function EmailStatus({
  email,
  verified,
  available,
  justVerified,
}: {
  email: string;
  verified: boolean;
  available: boolean;
  justVerified: boolean;
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  return (
    <div className="space-y-3">
      <p className="text-ink">
        <span className="font-medium">{email}</span>{" "}
        <span className="text-ink-3">{verified ? "is confirmed." : "is not confirmed yet."}</span>
      </p>
      {justVerified && verified ? (
        <p role="status" className="text-[0.9375rem] text-ink-2">
          Thank you. sintr can now tell you by email when a report is ready, if you ask for it in Therapy.
        </p>
      ) : null}
      {!verified && available ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={state === "sending" || state === "sent"}
            onClick={() => {
              setState("sending");
              void authClient
                .sendVerificationEmail({ email, callbackURL: "/settings?verified=1" })
                .then((result) => setState(result.error ? "failed" : "sent"));
            }}
          >
            Send the confirmation link
          </Button>
          <p role="status" className="text-[0.9375rem] text-ink-3">
            {state === "sent"
              ? "The link is on its way. It works for an hour."
              : state === "failed"
                ? "It could not be sent just now. Try again in a few minutes."
                : "Needed only for email from sintr, such as a report being ready."}
          </p>
        </div>
      ) : null}
      {!available ? (
        <p className="text-[0.9375rem] text-ink-3">
          Email is not set up on this sintr, so nothing is sent to this address.
        </p>
      ) : null}
    </div>
  );
}
