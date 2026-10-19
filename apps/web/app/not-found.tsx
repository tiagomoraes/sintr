import { linkStyles } from "@sintr/ui";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getMessages } from "@/lib/server/language";

export default async function NotFound() {
  const t = (await getMessages()).common.notFound;
  return (
    <>
      <SiteHeader />
      <main id="main" className="wrap pb-24 pt-[clamp(32px,8vh,96px)]">
        <h1 className="text-title">{t.heading}</h1>
        <p className="mt-4 max-w-[34em] text-lede text-ink-2">
          {t.body}{" "}
          <Link href="/" className={linkStyles}>
            {t.link}
          </Link>
          {t.after}
        </p>
      </main>
    </>
  );
}
