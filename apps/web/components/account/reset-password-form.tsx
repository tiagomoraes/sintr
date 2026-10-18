"use client";

import { Button, FieldError, FieldHint, Input, Label, linkStyles } from "@sintr/ui";
import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { useHydrated } from "@/lib/use-hydrated";

/** Set a new password with the token from the emailed link. Every session ends. */
export function ResetPasswordForm({ token }: { token: string }) {
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
        Your password is changed, and every open session was signed out.{" "}
        <Link href="/sign-in" className={linkStyles}>
          Sign in
        </Link>
      </p>
    );
  }
  return (
    <form method="post" onSubmit={(event) => void onSubmit(event)} className="space-y-6">
      <div>
        <Label htmlFor={id}>New password</Label>
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
        <FieldHint>At least 10 characters. A short sentence works well.</FieldHint>
      </div>
      {state === "short" ? <FieldError>Use a password of at least 10 characters.</FieldError> : null}
      {state === "expired" ? (
        <FieldError>
          This link has expired or was already used.{" "}
          <Link href="/forgot-password" className={linkStyles}>
            Ask for a new one
          </Link>
        </FieldError>
      ) : null}
      <Button type="submit" disabled={!hydrated || state === "saving"}>
        Set the new password
      </Button>
    </form>
  );
}
