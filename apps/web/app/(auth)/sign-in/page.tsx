import { linkStyles } from "@sintr/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { safeNext } from "@/lib/redirect";
import { getSession, runtime } from "@/lib/server/runtime";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const next = safeNext((await searchParams).next);
  if (await getSession()) redirect(next);
  return (
    <>
      <h1 className="text-title">Welcome back.</h1>
      <p className="mt-4 text-lede text-ink-2">Sign in to open your diary.</p>
      <div className="mt-10">
        <AuthForm mode="sign-in" next={next} />
      </div>
      {runtime().email.available ? (
        <p className="mt-6 text-[0.9375rem]">
          <Link href="/forgot-password" className={linkStyles}>
            Forgot your password?
          </Link>
        </p>
      ) : null}
      <p className="mt-10 text-[0.9375rem] text-ink-3">
        New here?{" "}
        <Link href="/sign-up" className={linkStyles}>
          Create your diary
        </Link>
      </p>
    </>
  );
}
