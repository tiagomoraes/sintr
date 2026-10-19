import type { Invite, PracticeLink, ReceivedReport } from "@sintr/core";
import { cn, linkStyles } from "@sintr/ui";
import Link from "next/link";
import { cancelPatientInvite, disconnectPatient } from "@/app/(app)/practice/actions";
import { ConfirmButton } from "@/components/confirm-button";
import { CopyButton } from "@/components/connect/copy-button";
import { formatDay } from "@/lib/format";
import { reportTitle } from "@/lib/reports";
import { getMessages } from "@/lib/server/language";
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
export async function ReportList({
  reports,
  openId,
  locale,
}: {
  reports: readonly ReceivedReport[];
  openId: string | null;
  locale: Locale;
}) {
  const messages = await getMessages();
  const t = messages.practice.reports;
  return (
    <section aria-labelledby="reports-title">
      <Heading id="reports-title">{t.title}</Heading>
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
                      {patientLabel(report, messages)}
                    </span>
                    {report.firstReadAt ? null : (
                      <span className="inline-flex shrink-0 items-center gap-1.5 text-caption font-medium text-ink">
                        <span aria-hidden="true" className="size-[7px] rounded-full bg-ink" />
                        {t.new}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-[0.9375rem] text-ink-2">
                    {reportTitle(report, locale, messages)}
                  </span>
                  <span className="mt-0.5 block text-caption text-ink-3">
                    {t.shared(formatDay(report.sharedAt, locale))}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 max-w-[30em] text-[0.9375rem] text-ink-3">{t.none}</p>
      )}
    </section>
  );
}

/** The people linked, or waiting to confirm, each with one way to disconnect. */
export async function PatientList({
  patients,
  locale,
}: {
  patients: readonly PracticeLink[];
  locale: Locale;
}) {
  const messages = await getMessages();
  const t = messages.practice.patients;
  return (
    <section aria-labelledby="patients-title">
      <Heading id="patients-title">{t.title}</Heading>
      {patients.length ? (
        <ul className="mt-4 border-t border-rule">
          {patients.map((patient) => {
            const label = patientLabel(patient, messages);
            const waiting = patient.status === "pending";
            return (
              <li key={patient.id} className="border-b border-rule py-4">
                <p className="font-serif text-[1.0625rem] text-ink [overflow-wrap:anywhere]">{label}</p>
                <p className="mt-0.5 text-caption text-ink-3">
                  {waiting
                    ? t.waiting
                    : [
                        t.since(formatDay(patient.activeSince ?? patient.createdAt, locale)),
                        patient.lastSharedAt ? t.last(formatDay(patient.lastSharedAt, locale)) : null,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                </p>
                <div className="mt-3">
                  <ConfirmButton
                    label={waiting ? t.withdraw : t.disconnect}
                    ariaLabel={waiting ? t.withdrawLabel(label) : t.disconnectLabel(label)}
                    confirmLabel={waiting ? t.withdrawConfirm : t.disconnectConfirm}
                    keepLabel={t.keep}
                    pendingLabel={t.ending}
                    explanation={waiting ? t.withdrawExplanation(label) : t.disconnectExplanation(label)}
                    action={disconnectPatient.bind(null, patient.id)}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 max-w-[30em] text-[0.9375rem] text-ink-3">{t.none}</p>
      )}
    </section>
  );
}

/** Invites not yet accepted: each holds a seat until it is accepted, cancelled or expires. */
export async function InviteList({
  invites,
  origin,
  locale,
}: {
  invites: readonly Invite[];
  origin: string;
  locale: Locale;
}) {
  if (invites.length === 0) return null;
  const t = (await getMessages()).practice.invites;
  return (
    <section aria-labelledby="invites-title">
      <Heading id="invites-title">{t.title}</Heading>
      <ul className="mt-4 border-t border-rule">
        {invites.map((invite) => (
          <li key={invite.id} className="border-b border-rule py-4">
            <p className="flex flex-wrap items-baseline gap-x-3">
              <code className="font-mono text-[0.9375rem] text-ink">{invite.code}</code>
              {invite.note ? (
                <span className="text-[0.9375rem] text-ink-2 [overflow-wrap:anywhere]">{invite.note}</span>
              ) : null}
            </p>
            <p className="mt-0.5 text-caption text-ink-3">{t.until(formatDay(invite.expiresAt, locale))}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <CopyButton text={`${origin}${joinPath(invite.code)}`} label={t.copy(invite.code)} />
              <form action={cancelPatientInvite.bind(null, invite.id)}>
                <button
                  type="submit"
                  className={cn(linkStyles, "text-[0.9375rem] text-ink-2")}
                  aria-label={t.cancelLabel(invite.code)}
                >
                  {t.cancel}
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
