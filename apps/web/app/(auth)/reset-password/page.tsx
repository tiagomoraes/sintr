import { linkStyles } from "@sintr/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/account/reset-password-form";

export const metadata: Metadata = { title: "Set a new password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : null;
  return (
    <>
      <h1 className="text-title">Set a new password.</h1>
      {token && !params.error ? (
        <div className="mt-10">
          <ResetPasswordForm token={token} />
        </div>
      ) : (
        <p className="mt-4 text-lede text-ink-2">
          This link has expired or was already used.{" "}
          <Link href="/forgot-password" className={linkStyles}>
            Ask for a new one
          </Link>
        </p>
      )}
    </>
  );
}
