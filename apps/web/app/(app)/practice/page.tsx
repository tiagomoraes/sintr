import { sharedPaper } from "@sintr/core";
import { buttonVariants, linkStyles } from "@sintr/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/empty-state";
import { InviteList, PatientList, ReportList } from "@/components/practice/lists";
import { PracticeForm } from "@/components/practice/practice-form";
import { ReportPaper } from "@/components/reports/report-paper";
import { CodeForm } from "@/components/sharing/code-form";
import { MarkSeen } from "@/components/sharing/link-parts";
import { Notices } from "@/components/sharing/notices";
import { formatDay } from "@/lib/format";
import { reportTitle } from "@/lib/reports";
import { patientLabel, practiceDetails, recentNotices, seatsLine } from "@/lib/sharing";
import { requireScope, runtime } from "@/lib/server/runtime";
import { markPracticeNoticesRead, openPatientCode, openPractice } from "./actions";

export const metadata: Metadata = { title: "Your practice" };

const PROMISES = [
  "Your patients decide what you see: the reports they approve and share with you, nothing else.",
  "Each report is read as the person approved it. No scores, and nothing added up across patients.",
  "Either of you can end a link at any time, and it ends at once on both sides.",
];

function OpenPractice() {
  return (
    <>
      <PageHeading
        title="Your practice"
        lede="For therapists: receive the reports your patients choose to share with you, in one calm place."
      />
      <ul className="-mt-2 mb-12 max-w-[40rem] list-none border-t border-ink p-0">
        {PROMISES.map((line) => (
          <li key={line} className="border-b border-rule py-3.5 text-[0.9688rem] text-ink-2">
            {line}
          </li>
        ))}
      </ul>
      <div className="max-w-[40rem]">
        <PracticeForm
          save={openPractice}
          defaults={{ professionalName: "", practiceName: "", registration: "" }}
          submitLabel="Open my practice"
        />
        <p className="mt-8 text-[0.9375rem] text-ink-3">
          Your own diary stays as it is. Opening a practice adds this dashboard; nothing else changes.
        </p>
      </div>
    </>
  );
}

export default async function PracticePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { scope } = await requireScope();
  const practice = await scope.practice.get();
  if (!practice) return <OpenPractice />;
  const params = await searchParams;
  const openId = typeof params.report === "string" ? params.report : null;
  // Opening a report reads it: recorded in the audit of both accounts. Read first, so the list knows.
  const open = openId ? await scope.practice.readReport(openId) : null;
  const [seats, reports, patients, invites, notices, profile] = await Promise.all([
    scope.practice.seats(),
    scope.practice.reports(),
    scope.practice.patients(),
    scope.practice.invites(),
    scope.notices.list(),
    scope.profile.get(),
  ]);
  const paper = open ? sharedPaper(open.snapshot) : null;
  const locale = { language: "en", timezone: profile.timezone };
  const details = practiceDetails(practice);
  // Link news of the last two weeks; a new report shows in the list instead.
  const lately = recentNotices(notices, "practice", { skip: "report_shared" });
  const unseen = notices.some((n) => n.side === "practice" && !n.readAt);
  const waiting = invites.filter((invite) => invite.status === "pending");
  const origin = runtime().config.url.origin;

  return (
    <>
      <header className="mb-10 md:mb-12">
        <h1 className="text-title [overflow-wrap:anywhere]">{practice.professionalName}</h1>
        {details ? <p className="mt-3 text-[0.9688rem] text-ink-2">{details}</p> : null}
        <p role="status" className="mt-2 text-[0.9688rem] text-ink-2">
          {seatsLine(seats)}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
          <Link href="/practice/invite" className={buttonVariants({ size: "sm" })}>
            Invite a patient
          </Link>
          <Link href="/practice/details" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Practice details
          </Link>
        </div>
      </header>

      <Notices notices={lately} locale={locale} className="mb-10 max-w-[44rem]" />
      {unseen ? <MarkSeen action={markPracticeNoticesRead} /> : null}
      {openId && !open ? (
        <p role="status" className="mb-10 max-w-[44rem] text-[0.9688rem] text-ink-2">
          That report is not here any more: the link it came through has ended.
        </p>
      ) : null}

      <div
        className={
          open && paper
            ? "grid gap-12 min-[1100px]:grid-cols-[minmax(15rem,19rem)_minmax(0,1fr)] min-[1100px]:gap-10"
            : "max-w-[44rem]"
        }
      >
        <div className={open && paper ? "order-2 space-y-12 min-[1100px]:order-1" : "space-y-12"}>
          <ReportList reports={reports} openId={open?.id ?? null} locale={locale} />
          <PatientList patients={patients} locale={locale} />
          <InviteList invites={waiting} origin={origin} locale={locale} />
          <CodeForm open={openPatientCode} label="A code a patient gave you" button="Open it" />
        </div>
        {open && paper ? (
          <section aria-labelledby="open-report-title" className="order-1 min-w-0 min-[1100px]:order-2">
            <p className="mb-4 min-[1100px]:hidden">
              <Link href="/practice" className={linkStyles}>
                All reports
              </Link>
            </p>
            <header className="mb-6">
              <h2 id="open-report-title" className="font-serif text-title-small font-normal text-ink">
                {patientLabel(open)},{" "}
                <span className="text-ink-soft">
                  {reportTitle(open, locale).replace(/^./u, (c) => c.toLowerCase())}
                </span>
              </h2>
              <p className="mt-1 text-caption text-ink-3">
                Shared with you on {formatDay(open.sharedAt, locale)}. This is the report exactly as they
                approved it.
              </p>
              <p className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[0.9375rem]">
                <a href={`/api/practice/reports/${open.id}/pdf`} className={linkStyles}>
                  Download the PDF
                </a>
                <Link href="/practice" className={linkStyles}>
                  Close it
                </Link>
              </p>
            </header>
            <ReportPaper view={paper} />
          </section>
        ) : null}
      </div>
    </>
  );
}
