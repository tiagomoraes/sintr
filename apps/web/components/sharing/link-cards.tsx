import type { PersonLink } from "@sintr/core";
import { linkStyles } from "@sintr/ui";
import Link from "next/link";
import { confirmLink, declineLink, renameLink, setShareMode, stopSharing } from "@/app/(app)/sharing/actions";
import { ConfirmButton } from "@/components/confirm-button";
import { formatDay } from "@/lib/format";
import { reportTitle } from "@/lib/reports";
import { NEVER_SHARED, SCOPE_SENTENCE, patientLabel, practiceDetails, practiceWho } from "@/lib/sharing";
import { ConfirmForm, ModeForm, NameForm } from "./link-parts";

type Locale = { language: string; timezone: string };

function PracticeHeader({ link, title }: { link: PersonLink; title?: string }) {
  const details = practiceDetails(link.practice);
  return (
    <header className="border-b border-rule px-5 pb-4 pt-5 sm:px-6">
      <h3 className="font-serif text-title-small font-normal text-ink [overflow-wrap:anywhere]">
        {title ?? link.practice.professionalName}
      </h3>
      {details ? <p className="mt-1 text-caption text-ink-3">{details}</p> : null}
    </header>
  );
}

/** A practice that accepted the person's invite, waiting for their yes. */
export function PendingLinkCard({ link }: { link: PersonLink }) {
  const who = practiceWho(link.practice);
  return (
    <article
      aria-label={`${link.practice.professionalName} is waiting for your confirmation`}
      className="overflow-hidden rounded-file border border-ink bg-paper"
    >
      <PracticeHeader link={link} title={`${link.practice.professionalName} accepted your invite`} />
      <div className="space-y-5 px-5 py-5 sm:px-6">
        <p className="text-ink-2">
          Confirm it is your therapist, and the link starts. Until you do, nothing can be shared with them.
        </p>
        <ul className="m-0 list-none space-y-2 border-t border-rule p-0 pt-4 text-[0.9688rem] text-ink-2">
          <li>{SCOPE_SENTENCE}</li>
          <li>{NEVER_SHARED}</li>
          <li>You choose for each report, unless you decide otherwise. You can stop at any time.</li>
        </ul>
        <div className="border-t border-rule pt-5">
          <ConfirmForm
            who={who}
            confirm={confirmLink.bind(null, link.id)}
            decline={declineLink.bind(null, link.id)}
          />
        </div>
      </div>
    </article>
  );
}

/** An active link: what the therapist can see, how reports go, the name they see, what was shared. */
export function ActiveLinkCard({ link, locale }: { link: PersonLink; locale: Locale }) {
  const neutral = patientLabel({ personName: null, number: link.number });
  return (
    <article
      aria-label={`Sharing with ${link.practice.professionalName}`}
      className="overflow-hidden rounded-file border border-rule bg-paper shadow-card"
    >
      <PracticeHeader link={link} />
      <div className="space-y-7 px-5 py-6 sm:px-6">
        <div>
          <p className="font-serif text-[1.1875rem] leading-[1.4] text-ink">{SCOPE_SENTENCE}</p>
          <p className="mt-2 text-[0.9375rem] text-ink-3">
            {NEVER_SHARED} Linked since {formatDay(link.personAcceptedAt ?? link.createdAt, locale)}.
          </p>
        </div>
        <ModeForm mode={link.shareMode} save={setShareMode.bind(null, link.id)} />
        <NameForm name={link.personName} neutral={neutral} save={renameLink.bind(null, link.id)} />
        <section aria-label={`Reports shared with ${link.practice.professionalName}`}>
          <h4 className="text-label font-medium text-ink">What you shared with them</h4>
          {link.shares.length ? (
            <ul className="mt-3 border-t border-rule">
              {link.shares.map((share) => (
                <li key={share.id} className="border-b border-rule py-3">
                  <Link href={`/reports/${share.reportId}`} className={linkStyles}>
                    {reportTitle(share, locale)}
                  </Link>
                  <p className="mt-1 text-caption text-ink-3">
                    Shared on {formatDay(share.sharedAt, locale)}.{" "}
                    {share.firstReadAt
                      ? `They opened it on ${formatDay(share.firstReadAt, locale)}.`
                      : "Not opened yet."}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[0.9375rem] text-ink-3">
              Nothing yet. When you approve a report, you can share it with them from its page.
            </p>
          )}
        </section>
        <div className={link.shares.length ? "" : "border-t border-rule pt-5"}>
          <ConfirmButton
            label="Stop sharing"
            ariaLabel={`Stop sharing with ${link.practice.professionalName}`}
            confirmLabel="Yes, stop sharing"
            keepLabel="Keep sharing"
            pendingLabel="Stopping"
            explanation={
              <>
                {link.practice.professionalName} loses access at once to every report you shared here. A PDF
                they already downloaded stays with them, as an email would.
              </>
            }
            action={stopSharing.bind(null, link.id)}
          />
        </div>
      </div>
    </article>
  );
}
