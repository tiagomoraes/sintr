"use client";

import { Button, FieldError, Input, Label } from "@sintr/ui";
import { useId, useState, type FormEvent } from "react";
import { useMessages } from "@/components/language";
import { authClient } from "@/lib/auth-client";
import { useHydrated } from "@/lib/use-hydrated";

/**
 * Ask for a link to set a new password. The answer is the same whether or
 * not the address has a diary, so this page tells nobody who uses sintr.
 */
export function ForgotPasswordForm() {
  const t = useMessages().auth;
  const id = useId();
  const hydrated = useHydrated();
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = new FormData(event.currentTarget).get("email");
    if (typeof email !== "string") return;
    setState("sending");
    const result = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
    setState(result.error && result.error.status === 429 ? "failed" : "sent");
  }

  if (state === "sent") {
    return (
      <p role="status" className="text-lede text-ink-2">
        {t.forgot.sent}
      </p>
    );
  }
  return (
    <form method="post" onSubmit={(event) => void onSubmit(event)} className="space-y-6">
      <div>
        <Label htmlFor={id}>{t.form.email}</Label>
        <Input id={id} name="email" type="email" autoComplete="email" required className="mt-2" />
      </div>
      {state === "failed" ? <FieldError>{t.forgot.tooMany}</FieldError> : null}
      <Button type="submit" disabled={!hydrated || state === "sending"}>
        {t.forgot.send}
      </Button>
    </form>
  );
}
