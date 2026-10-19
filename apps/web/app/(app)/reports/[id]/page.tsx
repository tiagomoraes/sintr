import { isEmailAddress, practiceLine, reportView } from "@sintr/core";
import { linkStyles } from "@sintr/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportActions, type PracticeChoice } from "@/components/reports/report-actions";
import { ReportChanges } from "@/components/reports/report-changes";
import { ReportPaper } from "@/components/reports/report-paper";
import { formatDay, formatMoment } from "@/lib/format";
import { authorInWords, problemInWords } from "@/lib/reports";
import { practiceWho } from "@/lib/sharing";
import { currentLanguage, getMessages } from "@/lib/server/language";
import { requireScope, runtime } from "@/lib/server/runtime";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).reports.report.title };
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { scope } = await requireScope();
  const report = await scope.reports.get(id);
  if (!report) notFound();
  const [view, revisions, links] = await Promise.all([
    reportView(scope, report),
    scope.reports.revisions(id),
    scope.sharing.links(),
  ]);
  if (!view) notFound();
  const [t, language] = await Promise.all([getMessages(), currentLanguage()]);
  const words = t.reports;
  const locale = { language: language.code, timezone: view.timeZone };
  // The practices the person is linked with, and whether this report went to each.
  const practices: PracticeChoice[] = links
    .filter((link) => link.status === "active")
    .map((link) => {
      const share = link.shares.find((s) => s.reportId === id);
      return {
        linkId: link.id,
        who: practiceWho(link.practice),
        name: link.practice.professionalName,
        line: practiceLine(link.practice),
        automatic: link.shareMode === "auto",
        shared: share
          ? words.report.sharedWith(
              link.practice.professionalName,
              formatDay(share.sharedAt, locale),
              share.firstReadAt ? formatDay(share.firstReadAt, locale) : null,
            )
          : null,
      };
    });
  const { therapist } = view;
  const emailAvailable = runtime().email.available;
  const delivery =
    therapist.deliveryChannel !== "email"
      ? ({ kind: "keep" } as const)
      : !therapist.therapistContact || !isEmailAddress(therapist.therapistContact)
        ? ({ kind: "no_address" } as const)
        : !emailAvailable
          ? ({ kind: "email_off" } as const)
          : ({
              kind: "email",
              therapist: therapist.therapistName,
              email: therapist.therapistContact,
            } as const);
  const pdf = `/api/reports/${id}/pdf`;

  return (
    <>
      <p className="mb-6">
        <Link href="/reports" className={linkStyles}>
          {words.report.all}
        </Link>
      </p>
      <header className="mb-8">
        <h1 className="text-title">
          {view.period.session ? (
            <>
              {words.report.heading.session}{" "}
              <span className="text-ink-soft">{formatMoment(view.period.session, locale)}</span>
            </>
          ) : (
            <>
              {words.report.heading.week}{" "}
              <span className="text-ink-soft">{words.report.week(view.period.label)}</span>
            </>
          )}
        </h1>
        <p className="mt-4 inline-flex items-center gap-2.5 text-caption text-ink-2" role="status">
          {report.status === "draft" ? (
            <span
              aria-hidden="true"
              className="size-[7px] rounded-full bg-draft shadow-[0_0_0_3px_#fbe6da]"
            />
          ) : null}
          {report.status === "sent" && report.sentAt
            ? words.report.sent(report.recipient, formatMoment(report.sentAt, locale))
            : report.sharedAt
              ? words.report.shared(formatMoment(report.sharedAt, locale))
              : words.status[report.status]}
        </p>
        <p className="mt-2 max-w-[38em] text-[0.9375rem] text-ink-3">
          {words.report.covers(
            formatMoment(report.periodStart, locale),
            formatMoment(report.periodEnd, locale),
          )}
        </p>
      </header>

      {view.content.author === "sintr" ? (
        <div className="mb-8 max-w-[44rem] rounded-file border border-rule bg-wash px-[22px] py-5 text-[0.9688rem] text-ink-2">
          {authorInWords(view.content.problem, words)}
          {view.content.problem === "limit_reached" ? (
            <>
              {" "}
              <Link href="/plan" className={linkStyles}>
                {words.report.seePlan}
              </Link>
            </>
          ) : null}
        </div>
      ) : null}
      {view.check.problems.length > 0 && report.status !== "sent" ? (
        <section
          aria-labelledby="problems-title"
          className="mb-8 max-w-[44rem] rounded-file border border-rule px-[22px] py-5"
        >
          <h2 id="problems-title" className="font-serif text-title-small font-normal text-ink">
            {words.report.problems}
          </h2>
          <ul className="mt-3 list-none space-y-2 p-0 text-[0.9688rem] text-ink-2">
            {view.check.problems.map((problem, i) => (
              <li key={i}>{problemInWords(problem.code, problem.detail, words)}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mb-12">
        <ReportActions
          id={id}
          status={report.status}
          edited={report.editedAt !== null}
          shared={report.sharedAt !== null}
          delivery={delivery}
          practices={practices}
        />
      </div>

      <ReportPaper view={view} />

      <section aria-labelledby="pdf-title" className="mt-16">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 id="pdf-title" className="font-serif text-title-small font-normal text-ink">
            {report.status === "draft" ? words.report.pdf.draftTitle : words.report.pdf.title}
          </h2>
          <p className="flex gap-5 text-[0.9375rem]">
            <a href={pdf} target="_blank" rel="noopener" className={linkStyles}>
              {words.report.pdf.open}
            </a>
            <a href={`${pdf}?download=1`} className={linkStyles}>
              {words.report.pdf.download}
            </a>
          </p>
        </div>
        <p className="mt-2 max-w-[38em] text-[0.9375rem] text-ink-3">
          {report.status === "draft" ? words.report.pdf.draftNote : words.report.pdf.note}
        </p>
        <iframe
          src={pdf}
          title={words.report.pdf.preview}
          className="mt-5 h-[min(88vh,1100px)] w-full rounded-paper border border-rule bg-wash"
        />
      </section>

      <ReportChanges revisions={revisions} locale={locale} />
    </>
  );
}
