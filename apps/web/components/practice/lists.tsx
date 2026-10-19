import type { Invite, PracticeLink, ReceivedReport } from "@sintr/core";
import { cn, linkStyles } from "@sintr/ui";
import Link from "next/link";
import { cancelPatientInvite, disconnectPatient } from "@/app/(app)/practice/actions";
import { ConfirmButton } from "@/components/confirm-button";
import { CopyButton } from "@/components/connect/copy-button";
import { formatDay } from "@/lib/format";
import { reportTitle } from "@/lib/reports";
import { joinPath, patientLabel } from "@/lib/sharing";

type Locale = { language: string; timezone: string };

function Heading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="font-serif text-title-small font-normal text-ink">
      {children}
    </h2>
  );
}

/** Reports received, newest first. Opening one reads it here, beside the list; it is never prefetched. */
export function ReportList({
  reports,
  openId,
  locale,
}: {
  reports: readonly ReceivedReport[];
  openId: string | null;
  locale: Locale;
}) {
  return (
    <section aria-labelledby="reports-title">
      <Heading id="reports-title">Reports</Heading>
      {reports.length ? (
        <ul className="mt-4 border-t border-rule">
          {reports.map((report) => {
            const current = report.id === openId;
            return (
              <li key={report.id} className="border-b border-rule">
                <Link
                  href={`/practice?report=${report.id}`}
                  prefetch={false}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "group relative block py-4 pl-4 no-underline",
                    current &&
                      "before:absolute before:inset-y-3 before:left-0 before:w-[2px] before:rounded-full before:bg-ink",
                  )}
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-serif text-[1.0625rem] text-ink group-hover:underline group-hover:decoration-rule-strong group-hover:underline-offset-[0.2em] [overflow-wrap:anywhere]">
                      {patientLabel(report)}
                    </span>
                    {report.firstReadAt ? null : (
                      <span className="inline-flex shrink-0 items-center gap-1.5 text-caption font-medium text-ink">
                        <span aria-hidden="true" className="size-[7px] rounded-full bg-ink" />
                        New
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-[0.9375rem] text-ink-2">
                    {reportTitle(report, locale)}
                  </span>
                  <span className="mt-0.5 block text-caption text-ink-3">
                    Shared on {formatDay(report.sharedAt, locale)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 max-w-[30em] text-[0.9375rem] text-ink-3">
          No reports yet. When a patient approves a report and shares it with you, it appears here.
        </p>
      )}
    </section>
  );
}

/** The people linked, or waiting to confirm, each with one way to disconnect. */
export function PatientList({ patients, locale }: { patients: readonly PracticeLink[]; locale: Locale }) {
  return (
    <section aria-labelledby="patients-title">
      <Heading id="patients-title">Patients</Heading>
      {patients.length ? (
        <ul className="mt-4 border-t border-rule">
          {patients.map((patient) => {
            const label = patientLabel(patient);
            return (
              <li key={patient.id} className="border-b border-rule py-4">
                <p className="font-serif text-[1.0625rem] text-ink [overflow-wrap:anywhere]">{label}</p>
                <p className="mt-0.5 text-caption text-ink-3">
                  {patient.status === "pending"
                    ? "Waiting for them to confirm."
                    : `Linked since ${formatDay(patient.activeSince ?? patient.createdAt, locale)}.${
                        patient.lastSharedAt ? ` Last report ${formatDay(patient.lastSharedAt, locale)}.` : ""
                      }`}
                </p>
                <div className="mt-3">
                  <ConfirmButton
                    label={patient.status === "pending" ? "Withdraw" : "Disconnect"}
                    ariaLabel={`${patient.status === "pending" ? "Withdraw from" : "Disconnect"} ${label}`}
                    confirmLabel={patient.status === "pending" ? "Yes, withdraw" : "Yes, disconnect"}
                    keepLabel="Keep the link"
                    pendingLabel="Ending the link"
                    explanation={
                      patient.status === "pending"
                        ? `The link with ${label} will not start. They are told.`
                        : `${label} stops sharing with your practice at once, and their reports leave this dashboard. They are told.`
                    }
                    action={disconnectPatient.bind(null, patient.id)}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 max-w-[30em] text-[0.9375rem] text-ink-3">
          No patients yet. Invite one, or open the code a patient gave you.
        </p>
      )}
    </section>
  );
}

/** Invites not yet accepted: each holds a seat until it is accepted, cancelled or expires. */
export function InviteList({
  invites,
  origin,
  locale,
}: {
  invites: readonly Invite[];
  origin: string;
  locale: Locale;
}) {
  if (invites.length === 0) return null;
  return (
    <section aria-labelledby="invites-title">
      <Heading id="invites-title">Invites waiting</Heading>
      <ul className="mt-4 border-t border-rule">
        {invites.map((invite) => (
          <li key={invite.id} className="border-b border-rule py-4">
            <p className="flex flex-wrap items-baseline gap-x-3">
              <code className="font-mono text-[0.9375rem] text-ink">{invite.code}</code>
              {invite.note ? (
                <span className="text-[0.9375rem] text-ink-2 [overflow-wrap:anywhere]">{invite.note}</span>
              ) : null}
            </p>
            <p className="mt-0.5 text-caption text-ink-3">
              Works until {formatDay(invite.expiresAt, locale)}.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <CopyButton text={`${origin}${joinPath(invite.code)}`} label={`the link for ${invite.code}`} />
              <form action={cancelPatientInvite.bind(null, invite.id)}>
                <button
                  type="submit"
                  className={cn(linkStyles, "text-[0.9375rem] text-ink-2")}
                  aria-label={`Cancel the invite ${invite.code}`}
                >
                  Cancel it
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
