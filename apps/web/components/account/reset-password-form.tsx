"use client";

import { Button, FieldError, FieldHint, Input, Label, linkStyles } from "@sintr/ui";
import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { useMessages } from "@/components/language";
import { authClient } from "@/lib/auth-client";
import { useHydrated } from "@/lib/use-hydrated";

/** Set a new password with the token from the emailed link. Every session ends. */
export function ResetPasswordForm({ token }: { token: string }) {
  const t = useMessages().auth;
  const id = useId();
  const hydrated = useHydrated();
  const [state, setState] = useState<"idle" | "saving" | "done" | "expired" | "short">("idle");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = new FormData(event.currentTarget).get("password");
    if (typeof password !== "string") return;
    if (password.length < 10) return setState("short");
    setState("saving");
    const result = await authClient.resetPassword({ newPassword: password, token });
    setState(result.error ? "expired" : "done");
  }

  if (state === "done") {
    return (
      <p role="status" className="text-lede text-ink-2">
        {t.reset.done}{" "}
        <Link href="/sign-in" className={linkStyles}>
          {t.reset.signIn}
        </Link>
      </p>
    );
  }
  return (
    <form method="post" onSubmit={(event) => void onSubmit(event)} className="space-y-6">
      <div>
        <Label htmlFor={id}>{t.reset.label}</Label>
        <Input
          id={id}
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          maxLength={128}
          required
          className="mt-2"
        />
        <FieldHint>{t.form.passwordHint}</FieldHint>
      </div>
      {state === "short" ? <FieldError>{t.errors.tooShort}</FieldError> : null}
      {state === "expired" ? (
        <FieldError>
          {t.reset.expired}{" "}
          <Link href="/forgot-password" className={linkStyles}>
            {t.reset.askAgain}
          </Link>
        </FieldError>
      ) : null}
      <Button type="submit" disabled={!hydrated || state === "saving"}>
        {t.reset.save}
      </Button>
    </form>
  );
}
