"use client";

import { Button, Checkbox, FieldError, FieldHint, Input, Label } from "@sintr/ui";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { useMessages } from "@/components/language";
import { authClient } from "@/lib/auth-client";
import type { Messages } from "@/messages";
import { ConsentStatement } from "./consent-statement";

type Mode = "sign-in" | "sign-up";

/** Plain-language messages for what Better Auth reports. Never echoes input. */
function messageFor(
  error: { status?: number; code?: string } | null | undefined,
  says: Messages["auth"]["errors"],
): string {
  if (!error) return says.generic;
  if (error.status === 429) return says.tooMany;
  switch (error.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return says.mismatch;
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return says.exists;
    case "PASSWORD_TOO_SHORT":
      return says.tooShort;
    case "PASSWORD_TOO_LONG":
      return says.tooLong;
    case "INVALID_EMAIL":
      return says.badEmail;
    case "CONSENT_REQUIRED":
      return says.consent;
    case "EMAIL_PASSWORD_SIGN_UP_DISABLED":
      return says.closed;
    default:
      return says.generic;
  }
}

export function AuthForm({ mode, next }: { mode: Mode; next: string }) {
  const t = useMessages().auth;
  const router = useRouter();
  const ids = { email: useId(), password: useId(), consent: useId(), error: useId() };
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const field = (name: string) => {
      const value = form.get(name);
      return typeof value === "string" ? value : "";
    };
    const email = field("email");
    const password = field("password");
    setPending(true);
    setError(null);

    const result =
      mode === "sign-up"
        ? await authClient.signUp.email({
            email,
            password,
            // The auth table keeps no name; the server enforces it too.
            name: "",
            // Where the confirmation link (sent when email is set up) lands.
            callbackURL: "/settings?verified=1",
            // LGPD art. 11: the server refuses the account without it.
            ...({ consent: form.get("consent") === "on" } as Record<string, unknown>),
          })
        : await authClient.signIn.email({ email, password });

    if (result.error) {
      setError(messageFor(result.error, t.errors));
      setPending(false);
      return;
    }
    // A new diary opens on the welcome, which carries on to where the person was going.
    router.replace(
      mode === "sign-up" ? `/welcome${next === "/home" ? "" : `?next=${encodeURIComponent(next)}`}` : next,
    );
    router.refresh();
  }

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      aria-describedby={error ? ids.error : undefined}
      className="space-y-6"
    >
      <div>
        <Label htmlFor={ids.email}>{t.form.email}</Label>
        <Input
          id={ids.email}
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-2"
          aria-invalid={error ? true : undefined}
        />
      </div>
      <div>
        <Label htmlFor={ids.password}>{t.form.password}</Label>
        <Input
          id={ids.password}
          name="password"
          type="password"
          autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
          minLength={mode === "sign-up" ? 10 : undefined}
          maxLength={128}
          required
          className="mt-2"
          aria-invalid={error ? true : undefined}
        />
        {mode === "sign-up" ? <FieldHint>{t.form.passwordHint}</FieldHint> : null}
      </div>
      {mode === "sign-up" ? (
        <div className="flex items-start gap-3">
          <Checkbox id={ids.consent} name="consent" required />
          <label htmlFor={ids.consent} className="text-[0.9688rem] leading-[1.55] text-ink-2">
            <ConsentStatement />
          </label>
        </div>
      ) : null}
      {error ? <FieldError id={ids.error}>{error}</FieldError> : null}
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {mode === "sign-up" ? t.form.signUp : t.form.signIn}
      </Button>
    </form>
  );
}
