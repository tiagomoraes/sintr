import { linkStyles } from "@sintr/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getSession, runtime } from "@/lib/server/runtime";

export const metadata: Metadata = { title: "Create your diary" };

export default async function SignUpPage() {
  if (await getSession()) redirect("/entries");
  const open = runtime().config.signup === "open";
  return (
    <>
      <h1 className="text-title">Create your diary.</h1>
      {open ? (
        <>
          <p className="mt-4 text-lede text-ink-2">
            An email and a password are all it takes. No name, no profile to fill in.
          </p>
          <div className="mt-10">
            <AuthForm mode="sign-up" next="/entries" />
          </div>
        </>
      ) : (
        <p className="mt-4 text-lede text-ink-2">
          Sign-up is closed on this sintr. If it is yours, set SINTR_SIGNUP to open and restart it.
        </p>
      )}
      <p className="mt-10 text-[0.9375rem] text-ink-3">
        Already keeping one?{" "}
        <Link href="/sign-in" className={linkStyles}>
          Sign in
        </Link>
      </p>
    </>
  );
}
