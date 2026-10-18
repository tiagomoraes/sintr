import { linkStyles } from "@sintr/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/account/forgot-password-form";
import { runtime } from "@/lib/server/runtime";

export const metadata: Metadata = { title: "Forgot your password" };

export default function ForgotPasswordPage() {
  const available = runtime().email.available;
  return (
    <>
      <h1 className="text-title">A new password.</h1>
      {available ? (
        <>
          <p className="mt-4 text-lede text-ink-2">
            Write your email and sintr sends you a link to set a new one.
          </p>
          <div className="mt-10">
            <ForgotPasswordForm />
          </div>
        </>
      ) : (
        <p className="mt-4 text-lede text-ink-2">
          Email is not set up on this sintr, so it cannot send a link. If it is yours, set up SMTP as
          described in docs/SELFHOST.md.
        </p>
      )}
      <p className="mt-10 text-[0.9375rem] text-ink-3">
        <Link href="/sign-in" className={linkStyles}>
          Back to sign in
        </Link>
      </p>
    </>
  );
}
