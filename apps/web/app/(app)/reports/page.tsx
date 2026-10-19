import { preparationTime, upcomingSession } from "@sintr/core";
import { linkStyles } from "@sintr/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeading } from "@/components/empty-state";
import { PrepareButton } from "@/components/reports/prepare-button";
import { formatDay, formatMoment } from "@/lib/format";
import { formatNext } from "@/lib/plan";
import { reportTitle } from "@/lib/reports";
import { assistantState } from "@/lib/server/assistant";
import { currentLanguage, getMessages } from "@/lib/server/language";
import { requireScope } from "@/lib/server/runtime";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).reports.title };
}

export default async function ReportsPage() {
  const { scope } = await requireScope();
  const [reports, profile, schedule, assistant, month] = await Promise.all([
    scope.reports.list(),
    scope.profile.get(),
    scope.sessions.schedule(),
    assistantState(scope),
    scope.plans.current(),
  ]);
  const [t, language] = await Promise.all([getMessages(), currentLanguage()]);
  const words = t.reports;
  // On the house assistant, once this month's reports are used, the next ones come from the person's own words.
  const reportsUsed =
    assistant.kind === "house" &&
    month.plan.allowance.reports !== null &&
    month.used.reports >= month.plan.allowance.reports;
  const locale = { language: language.code, timezone: profile.timezone };
  const session = upcomingSession(schedule, profile.timezone, new Date());
  const prepared = session ? preparationTime(schedule, session) : null;
  const next =
    session && prepared
      ? words.list.next(formatMoment(prepared, locale), formatMoment(session, locale))
      : null;

  return (
    <>
      <PageHeading title={words.title} lede={words.lede} />
      <div className="-mt-4 mb-12 space-y-4 md:-mt-6">
        <p className="max-w-[36em] text-[0.9688rem] text-ink-2">
          {prepared && next ? (
            <>
              {next[0]}
              <span className="font-serif italic text-ink">{formatMoment(prepared, locale)}</span>
              {next[1]}
            </>
          ) : (
            <>
              {words.list.noSession}{" "}
              <Link href="/therapy" className={linkStyles}>
                {words.list.setSessions}
              </Link>
            </>
          )}
        </p>
        {reportsUsed ? (
          <p className="max-w-[36em] text-[0.9375rem] text-ink-3">
            {words.list.used(formatNext(month.period.next, language.code))}{" "}
            <Link href="/plan" className={linkStyles}>
              {words.list.yourPlan}
            </Link>
          </p>
        ) : null}
        <PrepareButton label={session ? words.list.prepareNow : words.list.prepareWeek} />
      </div>
      {reports.length === 0 ? (
        <EmptyState title={words.list.empty}>
          <p>{words.list.emptyBody}</p>
        </EmptyState>
      ) : (
        <ol className="border-t border-rule">
          {reports.map((report) => (
            <li key={report.id} className="border-b border-rule">
              <Link href={`/reports/${report.id}`} className="group block py-5 no-underline">
                <span className="block font-serif text-title-small text-ink group-hover:underline group-hover:decoration-rule-strong group-hover:underline-offset-[0.2em]">
                  {reportTitle(report, locale, t)}
                </span>
                <span className="mt-1 block text-[0.9375rem] text-ink-3">
                  {words.list.range(
                    formatDay(report.periodStart, locale),
                    formatDay(report.periodEnd, locale),
                  )}
                </span>
                <span className="mt-2 inline-flex items-center gap-2.5 text-caption text-ink-2">
                  {report.status === "draft" ? (
                    <span
                      aria-hidden="true"
                      className="size-[7px] rounded-full bg-draft shadow-[0_0_0_3px_#fbe6da]"
                    />
                  ) : null}
                  {report.status === "sent" && report.sentAt
                    ? words.list.sent(report.recipient, formatDay(report.sentAt, locale))
                    : report.sharedAt
                      ? words.list.shared(formatDay(report.sharedAt, locale))
                      : words.status[report.status]}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
