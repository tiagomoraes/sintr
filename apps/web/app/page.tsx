import { Button, WindowLight, buttonVariants, linkStyles } from "@sintr/ui";
import Link from "next/link";
import { HeaderLink, SiteHeader } from "@/components/site-header";
import { LanguageOffers } from "@/components/language";
import { SupportLines } from "@/components/support-lines";
import { getMessages } from "@/lib/server/language";
import { getSession } from "@/lib/server/runtime";

export default async function Home() {
  const session = await getSession();
  const t = (await getMessages()).common.landing;

  return (
    <>
      {/* The held wall: the light lands in the upper right of the first viewport. */}
      <WindowLight className="right-[-9vw] top-[-6vh] h-[min(105vh,980px)] w-[clamp(460px,62vw,980px)] max-[720px]:right-[-40vw] max-[720px]:opacity-70" />
      <SiteHeader>
        {session ? (
          <Link href="/home" className={buttonVariants({ size: "sm" })}>
            {t.open}
          </Link>
        ) : (
          <>
            <HeaderLink href="/sign-in">{t.signIn}</HeaderLink>
            <Link href="/sign-up" className={buttonVariants({ size: "sm" })}>
              {t.create}
            </Link>
          </>
        )}
      </SiteHeader>

      <main id="main" className="relative z-10">
        <section className="wrap grid min-h-[calc(100svh-88px)] grid-cols-12 items-center gap-x-6 pb-[clamp(64px,10vh,120px)] pt-[clamp(40px,6vh,72px)]">
          <div className="col-span-12 md:col-span-8 lg:col-span-7">
            <h1 className="text-display">{t.heading}</h1>
            <p className="mt-[clamp(24px,2.6vw,36px)] max-w-[34em] text-lede text-ink-2">{t.lede}</p>
            <div className="mt-[clamp(32px,3.4vw,44px)] flex flex-wrap items-center gap-x-7 gap-y-4">
              {session ? (
                <Button asChild>
                  <Link href="/home">{t.open}</Link>
                </Button>
              ) : (
                <>
                  <Button asChild>
                    <Link href="/sign-up">{t.create}</Link>
                  </Button>
                  <Link href="/sign-in" className={linkStyles}>
                    {t.already}
                  </Link>
                </>
              )}
            </div>
            <p className="mt-7 max-w-[36em] text-[0.9375rem] text-ink-3">{t.promise}</p>
          </div>
        </section>

        <section className="border-t border-rule">
          <div className="wrap grid grid-cols-12 gap-x-6 gap-y-10 py-section">
            <h2 className="col-span-12 max-w-[15.5em] text-headline md:col-span-7">
              <span className="block">{t.record}</span>
              <span className="block text-ink-soft">{t.therapy}</span>
            </h2>
            <div className="col-span-12 md:col-span-5 md:self-end">
              <p className="max-w-[36em] text-ink-2">{t.limits}</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-rule">
        <div className="wrap py-16">
          <SupportLines />
          <LanguageOffers className="mt-10" />
        </div>
      </footer>
    </>
  );
}
