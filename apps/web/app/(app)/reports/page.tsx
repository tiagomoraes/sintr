import type { ReportStatus } from "@sintr/core";
import type { Metadata } from "next";
import { EmptyState, PageHeading } from "@/components/empty-state";
import { formatDay } from "@/lib/format";
import { requireScope } from "@/lib/server/runtime";

export const metadata: Metadata = { title: "Reports" };

const STATUS: Record<ReportStatus, string> = {
  draft: "Draft, waiting for you",
  reviewed: "Reviewed by you",
  sent: "Sent with your approval",
};

export default async function ReportsPage() {
  const { scope } = await requireScope();
  const [reports, profile] = await Promise.all([scope.reports.list(), scope.profile.get()]);

  return (
    <>
      <PageHeading
        title="Reports"
        lede="A short page about the days since your last session, prepared before the next one."
      />
      {reports.length === 0 ? (
        <EmptyState title="No reports yet.">
          <p>
            You read each report first. It goes to your therapist only if you approve that specific report,
            and never on its own.
          </p>
        </EmptyState>
      ) : (
        <ol className="border-t border-rule">
          {reports.map((report) => (
            <li key={report.id} className="border-b border-rule py-5">
              <p className="font-serif text-title-small text-ink">
                {formatDay(report.periodStart, profile)} to {formatDay(report.periodEnd, profile)}
              </p>
              <p className="mt-1 inline-flex items-center gap-2.5 text-caption text-ink-2">
                {report.status === "draft" ? (
                  <span
                    aria-hidden="true"
                    className="size-[7px] rounded-full bg-draft shadow-[0_0_0_3px_#fbe6da]"
                  />
                ) : null}
                {STATUS[report.status]}
              </p>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
