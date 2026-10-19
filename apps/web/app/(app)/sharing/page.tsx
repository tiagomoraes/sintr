import { buttonVariants } from "@sintr/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/empty-state";
import { CodeForm } from "@/components/sharing/code-form";
import { ActiveLinkCard, PendingLinkCard } from "@/components/sharing/link-cards";
import { MarkSeen } from "@/components/sharing/link-parts";
import { Notices } from "@/components/sharing/notices";
import { formatDay } from "@/lib/format";
import { recentNotices } from "@/lib/sharing";
import { requireScope } from "@/lib/server/runtime";
import { cancelTherapistInvite, markSharingNoticesRead, openCode } from "./actions";

export const metadata: Metadata = { title: "Sharing" };

const HOW = [
  {
    term: "Approved reports only",
    text: "A report reaches your therapist only after you approve it. Drafts, entries, check-ins and conversations never do.",
  },
  {
    term: "Read in sintr",
    text: "They read it in their practice on sintr and can download its PDF. A PDF they download stays with them, as an email would.",
  },
  {
    term: "One action to stop",
    text: "Stop sharing and they lose access at once to everything you shared through sintr.",
  },
  { term: "You can see it", text: "Each report you share says when they first opened it." },
];

export default async function SharingPage() {
  const { scope } = await requireScope();
  const [links, invites, notices, profile] = await Promise.all([
    scope.sharing.links(),
    scope.sharing.invites(),
    scope.notices.list(),
    scope.profile.get(),
  ]);
  const locale = { language: "en", timezone: profile.timezone };
  // News about the person's links from the last two weeks, the unseen ones marked.
  const lately = recentNotices(notices, "person");
  const unseen = lately.some((n) => !n.readAt);
  const pending = links.filter((link) => link.status === "pending");
  const active = links.filter((link) => link.status === "active");
  const waiting = invites.filter((invite) => invite.status === "pending");

  return (
    <>
      <PageHeading
        title="Who can see what you write"
        lede="Your diary is yours alone. You can give your therapist access to the reports you approve, and take it back at any time."
      />

      <Notices notices={lately} locale={locale} className="-mt-4 mb-10 max-w-[40rem] md:-mt-6" />
      {unseen ? <MarkSeen action={markSharingNoticesRead} /> : null}

      <p role="status" className="-mt-4 mb-10 max-w-[36em] text-[0.9688rem] text-ink-2 md:-mt-6">
        {active.length === 0
          ? "Right now nobody can see anything you write."
          : active.length === 1
            ? `${active[0]!.practice.professionalName} can read the reports you share with them. Nobody else can see anything.`
            : `${active.length} therapists can read the reports you share with each of them. Nobody else can see anything.`}
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
          Give your therapist access
        </h2>
        <div className="mt-6 grid gap-8 sm:grid-cols-2 sm:gap-6">
          <div className="rounded-file border border-rule px-5 py-5">
            <p className="font-medium text-ink">They gave you a code</p>
            <p className="mt-1 text-[0.9375rem] text-ink-2">
              Your therapist has a practice on sintr and sent you a code or a link.
            </p>
            <div className="mt-5">
              <CodeForm open={openCode} label="The code" button="Continue" />
            </div>
          </div>
          <div className="rounded-file border border-rule px-5 py-5">
            <p className="font-medium text-ink">Invite your therapist</p>
            <p className="mt-1 text-[0.9375rem] text-ink-2">
              sintr makes a link for you to send them. They accept it from their practice, then you confirm.
            </p>
            <Link
              href="/sharing/invite"
              className={`${buttonVariants({ variant: "outline", size: "sm" })} mt-5`}
            >
              Invite your therapist
            </Link>
          </div>
        </div>
        {waiting.length ? (
          <div className="mt-8">
            <h3 className="text-label font-medium text-ink">Invites waiting for your therapist</h3>
            <ul className="mt-3 border-t border-rule">
              {waiting.map((invite) => (
                <li
                  key={invite.id}
                  className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-rule py-3"
                >
                  <span className="text-[0.9375rem] text-ink-2">
                    <code className="font-mono text-ink">{invite.code}</code>, works until{" "}
                    {formatDay(invite.expiresAt, locale)}
                  </span>
                  <form action={cancelTherapistInvite.bind(null, invite.id)}>
                    <button
                      type="submit"
                      className="text-[0.9375rem] text-ink-2 underline decoration-rule-strong underline-offset-[0.28em] hover:text-ink"
                      aria-label={`Cancel the invite ${invite.code}`}
                    >
                      Cancel it
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
          How sharing works
        </h2>
        <dl className="mt-6 border-t border-ink">
          {HOW.map((item) => (
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
