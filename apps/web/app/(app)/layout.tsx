import Link from "next/link";
import type { ReactNode } from "react";
import { LanguageOffers } from "@/components/language";
import { ExceptOn, ShellFooter, ShellMain } from "@/components/shell-frame";
import { ShellLight } from "@/components/shell-light";
import { PhoneMenu, ShellNav } from "@/components/shell-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { SiteHeader } from "@/components/site-header";
import { SupportLines } from "@/components/support-lines";
import { formatMoment } from "@/lib/format";
import { noticeText } from "@/lib/sharing";
import { currentLanguage, getMessages } from "@/lib/server/language";
import { requireScope, runtime } from "@/lib/server/runtime";
import { hourIn, timeOfDay } from "@/lib/time-of-day";

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
  const [t, language] = await Promise.all([getMessages(), currentLanguage()]);
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
  const nav = {
    practice: practice !== null,
    plan: runtime().config.house !== null || runtime().payments !== null,
    dots: { sharing: unread.person > 0, practice: unread.practice > 0 },
  };
  return (
    <ShellLight time={timeOfDay(hourIn(profile.timezone))}>
      <SiteHeader home="/home">
        <span className="hidden text-caption text-ink-3 min-[900px]:inline">{user.email}</span>
        <span className="hidden min-[900px]:inline-flex">
          <SignOutButton />
        </span>
        <PhoneMenu
          {...nav}
          footer={
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-5">
              <span className="min-w-0 truncate text-caption text-ink-3">{user.email}</span>
              <SignOutButton />
            </div>
          }
        />
      </SiteHeader>
      <div className="wrap grid grid-cols-12 gap-x-6 gap-y-8 pb-24 pt-2 min-[900px]:pt-12">
        <aside className="hidden min-[900px]:col-span-3 min-[900px]:block">
          <div className="min-[900px]:sticky min-[900px]:top-7">
            <ShellNav {...nav} />
          </div>
        </aside>
        <ShellMain>
          {sharingNotice ? (
            <ExceptOn paths={["/sharing"]}>
              <p className={NOTICE}>
                <span aria-hidden="true" className="size-[7px] rounded-full bg-ink" />
                {noticeText(sharingNotice, t)}
                <Link href="/sharing" className={NOTICE_LINK}>
                  {t.shell.notice.openSharing}
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
                  ? t.shell.notice.reportReady(
                      formatMoment(notice.sessionAt, { language: language.code, timezone: profile.timezone }),
                    )
                  : t.shell.notice.weeklyReady}
                <Link href={`/reports/${notice.id}`} className={NOTICE_LINK}>
                  {t.shell.notice.readIt}
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
            practice={<p className="max-w-[44em] text-[0.9375rem] text-ink-3">{t.shell.practiceNote}</p>}
          />
          <LanguageOffers className="mt-10" />
        </div>
      </footer>
    </ShellLight>
  );
}
