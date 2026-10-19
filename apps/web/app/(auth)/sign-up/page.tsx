import { linkStyles } from "@sintr/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { safeNext } from "@/lib/redirect";
import { getMessages } from "@/lib/server/language";
import { getSession, runtime } from "@/lib/server/runtime";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).auth.signUp.title };
}

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const next = safeNext((await searchParams).next);
  if (await getSession()) redirect(next);
  const open = runtime().config.signup === "open";
  const t = (await getMessages()).auth.signUp;
  return (
    <>
      <h1 className="text-title">{t.heading}</h1>
      {open ? (
        <>
          <p className="mt-4 text-lede text-ink-2">{t.lede}</p>
          <div className="mt-10">
            <AuthForm mode="sign-up" next={next} />
          </div>
        </>
      ) : (
        <p className="mt-4 text-lede text-ink-2">{t.closed}</p>
      )}
      <p className="mt-10 text-[0.9375rem] text-ink-3">
        {t.already}{" "}
        <Link
          href={next === "/home" ? "/sign-in" : `/sign-in?next=${encodeURIComponent(next)}`}
          className={linkStyles}
        >
          {t.signIn}
        </Link>
      </p>
    </>
  );
}
