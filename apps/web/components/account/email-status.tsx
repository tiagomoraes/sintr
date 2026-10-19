"use client";

import { Button } from "@sintr/ui";
import { useState } from "react";
import { useMessages } from "@/components/language";
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
  const t = useMessages().auth.email;
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  return (
    <div className="space-y-3">
      <p className="text-ink">
        <span className="font-medium">{email}</span>{" "}
        <span className="text-ink-3">{verified ? t.confirmed : t.notConfirmed}</span>
      </p>
      {justVerified && verified ? (
        <p role="status" className="text-[0.9375rem] text-ink-2">
          {t.thanks}
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
            {t.send}
          </Button>
          <p role="status" className="text-[0.9375rem] text-ink-3">
            {state === "sent" ? t.sent : state === "failed" ? t.failed : t.why}
          </p>
        </div>
      ) : null}
      {!available ? <p className="text-[0.9375rem] text-ink-3">{t.unavailable}</p> : null}
    </div>
  );
}
