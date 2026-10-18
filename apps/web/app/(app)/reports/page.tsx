import { preparationTime, upcomingSession } from "@sintr/core";
import { linkStyles } from "@sintr/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeading } from "@/components/empty-state";
import { PrepareButton } from "@/components/reports/prepare-button";
import { formatDay, formatMoment } from "@/lib/format";
import { STATUS } from "@/lib/reports";
import { requireScope } from "@/lib/server/runtime";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const { scope } = await requireScope();
  const [reports, profile, settings] = await Promise.all([
    scope.reports.list(),
    scope.profile.get(),
    scope.therapySettings.get(),
  ]);
  const locale = { language: "en", timezone: profile.timezone };
  const session = upcomingSession(settings, profile.timezone, new Date());
  const prepared = session ? preparationTime(settings, session) : null;

  return (
    <>
      <PageHeading
        title="Reports"
        lede="A short page about the days since your last session, prepared before the next one. You read it first; it goes to your therapist only if you approve that report."
      />
      <div className="-mt-4 mb-12 space-y-4 md:-mt-6">
        <p className="max-w-[36em] text-[0.9688rem] text-ink-2">
          {session && prepared ? (
            <>
              The next one is prepared on{" "}
              <span className="font-serif italic text-ink">{formatMoment(prepared, locale)}</span>, for your
              session of {formatMoment(session, locale)}.
            </>
          ) : (
            <>
              No session day is set, so reports are prepared only when you ask.{" "}
              <Link href="/therapy" className={linkStyles}>
                Set your sessions
              </Link>
            </>
          )}
        </p>
        <PrepareButton label={session ? "Prepare it now" : "Prepare this week's report"} />
      </div>
      {reports.length === 0 ? (
        <EmptyState title="No reports yet.">
          <p>
            Each report covers the days since the last one, in your own words, with the numbers from your
            check-ins. Nothing in it is a score, and quiet weeks are fine.
          </p>
        </EmptyState>
      ) : (
        <ol className="border-t border-rule">
          {reports.map((report) => (
            <li key={report.id} className="border-b border-rule">
              <Link href={`/reports/${report.id}`} className="group block py-5 no-underline">
                <span className="block font-serif text-title-small text-ink group-hover:underline group-hover:decoration-rule-strong group-hover:underline-offset-[0.2em]">
                  {report.sessionAt
                    ? `For the session of ${formatMoment(report.sessionAt, locale)}`
                    : `Week of ${formatDay(report.periodStart, locale)}`}
                </span>
                <span className="mt-1 block text-[0.9375rem] text-ink-3">
                  {formatDay(report.periodStart, locale)} to {formatDay(report.periodEnd, locale)}
                </span>
                <span className="mt-2 inline-flex items-center gap-2.5 text-caption text-ink-2">
                  {report.status === "draft" ? (
                    <span
                      aria-hidden="true"
                      className="size-[7px] rounded-full bg-draft shadow-[0_0_0_3px_#fbe6da]"
                    />
                  ) : null}
                  {report.status === "sent" && report.sentAt
                    ? `Sent to ${report.recipient ?? "your therapist"} on ${formatDay(report.sentAt, locale)}`
                    : STATUS[report.status]}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
