import { buttonVariants } from "@sintr/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/empty-state";
import { CodeForm } from "@/components/sharing/code-form";
import { ActiveLinkCard, PendingLinkCard } from "@/components/sharing/link-cards";
import { MarkSeen } from "@/components/sharing/link-parts";
import { Notices } from "@/components/sharing/notices";
import { formatDay } from "@/lib/format";
import { getMessages, currentLanguage } from "@/lib/server/language";
import { recentNotices } from "@/lib/sharing";
import { requireScope } from "@/lib/server/runtime";
import { cancelTherapistInvite, markSharingNoticesRead, openCode } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).sharing.title };
}

export default async function SharingPage() {
  const { scope } = await requireScope();
  const [links, invites, notices, profile, messages, language] = await Promise.all([
    scope.sharing.links(),
    scope.sharing.invites(),
    scope.notices.list(),
    scope.profile.get(),
    getMessages(),
    currentLanguage(),
  ]);
  const t = messages.sharing;
  const locale = { language: language.code, timezone: profile.timezone };
  // News about the person's links from the last two weeks, the unseen ones marked.
  const lately = recentNotices(notices, "person");
  const unseen = lately.some((n) => !n.readAt);
  const pending = links.filter((link) => link.status === "pending");
  const active = links.filter((link) => link.status === "active");
  const waiting = invites.filter((invite) => invite.status === "pending");

  return (
    <>
      <PageHeading title={t.heading} lede={t.lede} />

      <Notices notices={lately} locale={locale} className="-mt-4 mb-10 max-w-[40rem] md:-mt-6" />
      {unseen ? <MarkSeen action={markSharingNoticesRead} /> : null}

      <p role="status" className="-mt-4 mb-10 max-w-[36em] text-[0.9688rem] text-ink-2 md:-mt-6">
        {active.length === 0
          ? t.seen.nobody
          : active.length === 1
            ? t.seen.one(active[0]!.practice.professionalName)
            : t.seen.many(active.length)}
      </p>

      {pending.length || active.length ? (
        <div className="max-w-[40rem] space-y-8">
          {pending.map((link) => (
            <PendingLinkCard key={link.id} link={link} />
          ))}
          {active.map((link) => (
            <ActiveLinkCard key={link.id} link={link} locale={locale} reportName={profile.displayName} />
          ))}
        </div>
      ) : null}

      <section
        aria-labelledby="give-title"
        className={`max-w-[40rem] ${pending.length || active.length ? "mt-16 border-t border-rule pt-12" : ""}`}
      >
        <h2 id="give-title" className="font-serif text-title-small font-normal text-ink">
          {t.give.title}
        </h2>
        <div className="mt-6 grid gap-8 sm:grid-cols-2 sm:gap-6">
          <div className="rounded-file border border-rule px-5 py-5">
            <p className="font-medium text-ink">{t.give.code.title}</p>
            <p className="mt-1 text-[0.9375rem] text-ink-2">{t.give.code.text}</p>
            <div className="mt-5">
              <CodeForm open={openCode} label={t.give.code.label} button={t.give.code.button} />
            </div>
          </div>
          <div className="rounded-file border border-rule px-5 py-5">
            <p className="font-medium text-ink">{t.invite.title}</p>
            <p className="mt-1 text-[0.9375rem] text-ink-2">{t.give.invite}</p>
            <Link
              href="/sharing/invite"
              className={`${buttonVariants({ variant: "outline", size: "sm" })} mt-5`}
            >
              {t.invite.title}
            </Link>
          </div>
        </div>
        {waiting.length ? (
          <div className="mt-8">
            <h3 className="text-label font-medium text-ink">{t.give.waiting}</h3>
            <ul className="mt-3 border-t border-rule">
              {waiting.map((invite) => (
                <li
                  key={invite.id}
                  className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-rule py-3"
                >
                  <span className="text-[0.9375rem] text-ink-2">
                    <code className="font-mono text-ink">{invite.code}</code>
                    {t.give.worksUntil(formatDay(invite.expiresAt, locale))}
                  </span>
                  <form action={cancelTherapistInvite.bind(null, invite.id)}>
                    <button
                      type="submit"
                      className="text-[0.9375rem] text-ink-2 underline decoration-rule-strong underline-offset-[0.28em] hover:text-ink"
                      aria-label={t.give.cancelLabel(invite.code)}
                    >
                      {t.give.cancel}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="how-title" className="mt-16 max-w-[40rem] border-t border-rule pt-12">
        <h2 id="how-title" className="font-serif text-title-small font-normal text-ink">
          {t.how.title}
        </h2>
        <dl className="mt-6 border-t border-ink">
          {t.how.items.map((item) => (
            <div
              key={item.term}
              className="grid gap-x-6 gap-y-1 border-b border-rule py-4 sm:grid-cols-[11rem_minmax(0,1fr)]"
            >
              <dt className="font-serif text-[1.0625rem] text-ink">{item.term}</dt>
              <dd className="m-0 text-[0.9688rem] text-ink-2">{item.text}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
