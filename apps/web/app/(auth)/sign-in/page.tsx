import { linkStyles } from "@sintr/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { safeNext } from "@/lib/redirect";
import { getMessages } from "@/lib/server/language";
import { getSession, runtime } from "@/lib/server/runtime";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).auth.signIn.title };
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const next = safeNext((await searchParams).next);
  if (await getSession()) redirect(next);
  const t = (await getMessages()).auth.signIn;
  return (
    <>
      <h1 className="text-title">{t.heading}</h1>
      <p className="mt-4 text-lede text-ink-2">{t.lede}</p>
      <div className="mt-10">
        <AuthForm mode="sign-in" next={next} />
      </div>
      {runtime().email.available ? (
        <p className="mt-6 text-[0.9375rem]">
          <Link href="/forgot-password" className={linkStyles}>
            {t.forgot}
          </Link>
        </p>
      ) : null}
      <p className="mt-10 text-[0.9375rem] text-ink-3">
        {t.newHere}{" "}
        <Link
          href={next === "/home" ? "/sign-up" : `/sign-up?next=${encodeURIComponent(next)}`}
          className={linkStyles}
        >
          {t.create}
        </Link>
      </p>
    </>
  );
}
