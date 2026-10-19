import Link from "next/link";
import type { ReactNode } from "react";
import { ExceptOn, ShellFooter, ShellMain } from "@/components/shell-frame";
import { ShellNav } from "@/components/shell-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { SiteHeader } from "@/components/site-header";
import { SupportLines } from "@/components/support-lines";
import { formatMoment } from "@/lib/format";
import { noticeText } from "@/lib/sharing";
import { requireScope } from "@/lib/server/runtime";

/** A calm notice, for a report of the last week only: an old draft is not chased. */
function recent(periodEnd: Date): boolean {
  return periodEnd.getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000;
}

const NOTICE =
  "mb-10 inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-file border border-rule bg-wash px-5 py-3 text-[0.9375rem] text-ink-2";
const NOTICE_LINK =
  "font-medium text-ink underline decoration-rule-strong underline-offset-[0.28em] hover:decoration-ink";

/**
 * The diary's shell. It stays mounted while the person moves between pages,
 * so nothing here is decided from the path of the first request: what
 * depends on the page (the footer, the width, which notice repeats the
 * page) is chosen on the client from the current path.
 */
export default async function ShellLayout({ children }: { children: ReactNode }) {
  const { user, scope } = await requireScope();
  const [waiting, profile, unread, practice] = await Promise.all([
    scope.reports.waiting(),
    scope.profile.get(),
    scope.notices.unread(),
    scope.practice.get(),
  ]);
  // One quiet line about the person's links (a practice accepted their invite, or ended a link).
  const sharingNotice =
    unread.person > 0
      ? ((await scope.notices.list(10)).find((n) => n.side === "person" && !n.readAt) ?? null)
      : null;
  const notice = !sharingNotice && waiting && recent(waiting.periodEnd) ? waiting : null;
  return (
    <>
      <SiteHeader home="/entries">
        <span className="hidden text-caption text-ink-3 sm:inline">{user.email}</span>
        <SignOutButton />
      </SiteHeader>
      <div className="wrap grid grid-cols-12 gap-x-6 gap-y-8 pb-24 pt-4 min-[900px]:pt-12">
        <aside className="col-span-12 min-[900px]:col-span-3">
          <div className="min-[900px]:sticky min-[900px]:top-7">
            <ShellNav
              practice={practice !== null}
              dots={{ sharing: unread.person > 0, practice: unread.practice > 0 }}
            />
          </div>
        </aside>
        <ShellMain>
          {sharingNotice ? (
            <ExceptOn paths={["/sharing"]}>
              <p className={NOTICE}>
                <span aria-hidden="true" className="size-[7px] rounded-full bg-ink" />
                {noticeText(sharingNotice)}
                <Link href="/sharing" className={NOTICE_LINK}>
                  Open Sharing
                </Link>
              </p>
            </ExceptOn>
          ) : null}
          {notice ? (
            <ExceptOn paths={["/reports", "/practice"]}>
              <p className={NOTICE}>
                <span
                  aria-hidden="true"
                  className="size-[7px] rounded-full bg-draft shadow-[0_0_0_3px_#fbe6da]"
                />
                {notice.sessionAt
                  ? `Your report for the session of ${formatMoment(notice.sessionAt, { language: "en", timezone: profile.timezone })} is ready to read.`
                  : "Your weekly report is ready to read."}
                <Link href={`/reports/${notice.id}`} className={NOTICE_LINK}>
                  Read it
                </Link>
              </p>
            </ExceptOn>
          ) : null}
          {children}
        </ShellMain>
      </div>
      <footer className="border-t border-rule">
        <div className="wrap py-14">
          <ShellFooter
            person={<SupportLines />}
            practice={
              <p className="max-w-[44em] text-[0.9375rem] text-ink-3">
                Reports arrive when a person approves and shares them, never in real time, and sintr does not
                watch over them: it is a diary people keep for themselves, not a clinical record, a monitoring
                tool or a crisis service. If something in a report worries you, reach the person the way you
                usually do.
              </p>
            }
          />
        </div>
      </footer>
    </>
  );
}
