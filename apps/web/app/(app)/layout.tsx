import Link from "next/link";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { ShellNav } from "@/components/shell-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { SiteHeader } from "@/components/site-header";
import { SupportLines } from "@/components/support-lines";
import { formatMoment } from "@/lib/format";
import { requireScope } from "@/lib/server/runtime";

/** A calm notice, for a report of the last week only: an old draft is not chased. */
function recent(periodEnd: Date): boolean {
  return periodEnd.getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000;
}

export default async function ShellLayout({ children }: { children: ReactNode }) {
  const { user, scope } = await requireScope();
  const [waiting, profile, path] = await Promise.all([
    scope.reports.waiting(),
    scope.profile.get(),
    headers().then((h) => h.get("x-sintr-path") ?? ""),
  ]);
  const notice = waiting && recent(waiting.periodEnd) && !path.startsWith("/reports") ? waiting : null;
  return (
    <>
      <SiteHeader home="/entries">
        <span className="hidden text-caption text-ink-3 sm:inline">{user.email}</span>
        <SignOutButton />
      </SiteHeader>
      <div className="wrap grid grid-cols-12 gap-x-6 gap-y-8 pb-24 pt-4 min-[900px]:pt-12">
        <aside className="col-span-12 min-[900px]:col-span-3">
          <div className="min-[900px]:sticky min-[900px]:top-7">
            <ShellNav />
          </div>
        </aside>
        <main id="main" className="col-span-12 min-[900px]:col-span-9 min-[900px]:max-w-[52rem]">
          {notice ? (
            <p className="mb-10 inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-file border border-rule bg-wash px-5 py-3 text-[0.9375rem] text-ink-2">
              <span
                aria-hidden="true"
                className="size-[7px] rounded-full bg-draft shadow-[0_0_0_3px_#fbe6da]"
              />
              {notice.sessionAt
                ? `Your report for the session of ${formatMoment(notice.sessionAt, { language: "en", timezone: profile.timezone })} is ready to read.`
                : "Your weekly report is ready to read."}
              <Link
                href={`/reports/${notice.id}`}
                className="font-medium text-ink underline decoration-rule-strong underline-offset-[0.28em] hover:decoration-ink"
              >
                Read it
              </Link>
            </p>
          ) : null}
          {children}
        </main>
      </div>
      <footer className="border-t border-rule">
        <div className="wrap py-14">
          <SupportLines />
        </div>
      </footer>
    </>
  );
}
