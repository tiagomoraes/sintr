import { linkStyles } from "@sintr/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/account/reset-password-form";
import { getMessages } from "@/lib/server/language";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).auth.reset.title };
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : null;
  const t = (await getMessages()).auth.reset;
  return (
    <>
      <h1 className="text-title">{t.heading}</h1>
      {token && !params.error ? (
        <div className="mt-10">
          <ResetPasswordForm token={token} />
        </div>
      ) : (
        <p className="mt-4 text-lede text-ink-2">
          {t.expired}{" "}
          <Link href="/forgot-password" className={linkStyles}>
            {t.askAgain}
          </Link>
        </p>
      )}
    </>
  );
}
