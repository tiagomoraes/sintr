import type { PersonLink } from "@sintr/core";
import { practiceLine } from "@sintr/core";
import { linkStyles } from "@sintr/ui";
import Link from "next/link";
import { confirmLink, declineLink, renameLink, setShareMode, stopSharing } from "@/app/(app)/sharing/actions";
import { ConfirmButton } from "@/components/confirm-button";
import { formatDay } from "@/lib/format";
import { reportTitle } from "@/lib/reports";
import { getMessages } from "@/lib/server/language";
import { patientLabel, practiceDetails, practiceWho } from "@/lib/sharing";
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
export async function PendingLinkCard({ link }: { link: PersonLink }) {
  const t = (await getMessages()).sharing;
  const who = practiceWho(link.practice);
  const name = link.practice.professionalName;
  return (
    <article
      aria-label={t.pending.label(name)}
      className="overflow-hidden rounded-file border border-ink bg-paper"
    >
      <PracticeHeader link={link} title={t.pending.title(name)} />
      <div className="space-y-5 px-5 py-5 sm:px-6">
        <p className="text-ink-2">{t.pending.body}</p>
        <ul className="m-0 list-none space-y-2 border-t border-rule p-0 pt-4 text-[0.9688rem] text-ink-2">
          <li>{t.scope}</li>
          <li>{t.never}</li>
          <li>{t.pending.each}</li>
        </ul>
        <div className="border-t border-rule pt-5">
          <ConfirmForm
            who={who}
            shown={practiceLine(link.practice)}
            confirm={confirmLink.bind(null, link.id)}
            decline={declineLink.bind(null, link.id)}
          />
        </div>
      </div>
    </article>
  );
}

/** An active link: what the therapist can see, how reports go, the name they see, what was shared. */
export async function ActiveLinkCard({
  link,
  locale,
  reportName,
}: {
  link: PersonLink;
  locale: Locale;
  /** The name the person put on their reports in Therapy, if any. */
  reportName: string | null;
}) {
  const messages = await getMessages();
  const t = messages.sharing;
  const name = link.practice.professionalName;
  const neutral = patientLabel({ personName: null, number: link.number }, messages);
  return (
    <article
      aria-label={t.active.label(name)}
      className="overflow-hidden rounded-file border border-rule bg-paper shadow-card"
    >
      <PracticeHeader link={link} />
      <div className="space-y-7 px-5 py-6 sm:px-6">
        <div>
          <p className="font-serif text-[1.1875rem] leading-[1.4] text-ink">{t.scope}</p>
          <p className="mt-2 text-[0.9375rem] text-ink-3">
            {t.never} {t.active.since(formatDay(link.personAcceptedAt ?? link.createdAt, locale))}
          </p>
        </div>
        <ModeForm mode={link.shareMode} save={setShareMode.bind(null, link.id)} />
        <NameForm
          name={link.personName}
          neutral={neutral}
          reportName={reportName}
          save={renameLink.bind(null, link.id)}
        />
        <section aria-label={t.active.shared.label(name)}>
          <h4 className="text-label font-medium text-ink">{t.active.shared.title}</h4>
          {link.shares.length ? (
            <ul className="mt-3 border-t border-rule">
              {link.shares.map((share) => (
                <li key={share.id} className="border-b border-rule py-3">
                  <Link href={`/reports/${share.reportId}`} className={linkStyles}>
                    {reportTitle(share, locale, messages)}
                  </Link>
                  <p className="mt-1 text-caption text-ink-3">
                    {t.active.shared.on(formatDay(share.sharedAt, locale))}{" "}
                    {share.firstReadAt
                      ? t.active.shared.opened(formatDay(share.firstReadAt, locale))
                      : t.active.shared.notOpened}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[0.9375rem] text-ink-3">{t.active.shared.none}</p>
          )}
        </section>
        <div className={link.shares.length ? "" : "border-t border-rule pt-5"}>
          <ConfirmButton
            label={t.active.stop.label}
            ariaLabel={t.active.stop.aria(name)}
            confirmLabel={t.active.stop.confirm}
            keepLabel={t.active.stop.keep}
            pendingLabel={t.active.stop.pending}
            explanation={t.active.stop.explanation(name)}
            action={stopSharing.bind(null, link.id)}
          />
        </div>
      </div>
    </article>
  );
}
