import { linkStyles } from "@sintr/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/account/forgot-password-form";
import { getMessages } from "@/lib/server/language";
import { runtime } from "@/lib/server/runtime";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).auth.forgot.title };
}

export default async function ForgotPasswordPage() {
  const available = runtime().email.available;
  const t = (await getMessages()).auth.forgot;
  return (
    <>
      <h1 className="text-title">{t.heading}</h1>
      {available ? (
        <>
          <p className="mt-4 text-lede text-ink-2">{t.lede}</p>
          <div className="mt-10">
            <ForgotPasswordForm />
          </div>
        </>
      ) : (
        <p className="mt-4 text-lede text-ink-2">{t.noEmail}</p>
      )}
      <p className="mt-10 text-[0.9375rem] text-ink-3">
        <Link href="/sign-in" className={linkStyles}>
          {t.back}
        </Link>
      </p>
    </>
  );
}
