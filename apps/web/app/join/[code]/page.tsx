import { practiceLine, type InvitePreview } from "@sintr/core";
import { buttonVariants, linkStyles } from "@sintr/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { HeaderLink, SiteHeader } from "@/components/site-header";
import { AcceptAsPersonForm, AcceptAsPracticeForm } from "@/components/sharing/join-forms";
import { formatDay } from "@/lib/format";
import {
  NEVER_SHARED,
  SCOPE_SENTENCE,
  joinPath,
  practiceDetails,
  practiceWho,
  seatsLine,
} from "@/lib/sharing";
import { tooManyLookups } from "@/lib/server/join";
import { getSession, runtime } from "@/lib/server/runtime";
import { acceptAsPerson, acceptAsPractice } from "./actions";

export const metadata: Metadata = { title: "An invite" };

function Shell({ children, signedIn }: { children: React.ReactNode; signedIn: boolean }) {
  return (
    <>
      <SiteHeader home={signedIn ? "/entries" : "/"}>
        {signedIn ? (
          <HeaderLink href="/entries">Your diary</HeaderLink>
        ) : (
          <HeaderLink href="/sign-in">Sign in</HeaderLink>
        )}
      </SiteHeader>
      <main id="main" className="relative z-10">
        <div className="wrap grid grid-cols-12 gap-x-6 pb-24 pt-[clamp(32px,8vh,96px)]">
          <div className="col-span-12 sm:col-span-10 md:col-span-8 lg:col-span-6">{children}</div>
        </div>
      </main>
    </>
  );
}

function SignInChoices({ path, newLabel }: { path: string; newLabel: string }) {
  const next = encodeURIComponent(path);
  return (
    <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-4">
      <Link href={`/sign-up?next=${next}`} className={buttonVariants()}>
        {newLabel}
      </Link>
      <Link href={`/sign-in?next=${next}`} className={linkStyles}>
        I already have one
      </Link>
    </div>
  );
}

function Invalid({ signedIn, busy }: { signedIn: boolean; busy: boolean }) {
  return (
    <Shell signedIn={signedIn}>
      <h1 className="text-title">
        {busy ? "Too many tries from here." : "This invite does not work any more."}
      </h1>
      <p className="mt-4 text-lede text-ink-2">
        {busy
          ? "Wait a few minutes, then open the link again."
          : "It may have expired, been cancelled or been used already. Ask the person who sent it for a new one."}
      </p>
      <p className="mt-10">
        <Link href={signedIn ? "/entries" : "/"} className={linkStyles}>
          {signedIn ? "Back to your diary" : "What is sintr?"}
        </Link>
      </p>
    </Shell>
  );
}

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const session = await getSession();
  const signedIn = Boolean(session);
  if (await tooManyLookups()) return <Invalid signedIn={signedIn} busy />;
  const preview: InvitePreview = await runtime().repositories.previewInvite(code, session?.user.id ?? null);
  if (preview.status === "invalid") return <Invalid signedIn={signedIn} busy={false} />;
  const path = joinPath(code);
  const scope = session ? await runtime().repositories.forUser(session.user.id) : null;
  const profile = scope ? await scope.profile.get() : null;
  const until = formatDay(preview.expiresAt, { language: "en", timezone: profile?.timezone ?? "UTC" });

  if (preview.direction === "practice_to_person") {
    const { practice } = preview;
    const details = practiceDetails(practice);
    return (
      <Shell signedIn={signedIn}>
        <h1 className="text-title">
          {practice.professionalName}{" "}
          <span className="text-ink-soft">invites you to share your reports.</span>
        </h1>
        <div className="mt-8 rounded-file border border-rule bg-paper px-5 py-4 shadow-card">
          <p className="font-serif text-title-small text-ink [overflow-wrap:anywhere]">
            {practice.professionalName}
          </p>
          {details ? <p className="mt-1 text-caption text-ink-3">{details}</p> : null}
        </div>
        <ul className="mt-8 list-none space-y-3 border-t border-ink p-0 pt-5 text-ink-2">
          <li>
            <span className="font-medium text-ink">{SCOPE_SENTENCE}</span> {NEVER_SHARED}
          </li>
          <li>
            You choose for each report, unless you decide otherwise. Nothing goes to them until you approve
            it.
          </li>
          <li>You can stop at any time, and they lose access at once.</li>
        </ul>
        {!session ? (
          <>
            <p className="mt-8 text-[0.9375rem] text-ink-3">
              sintr is a private diary for the week between sessions. To accept, create yours or sign in. The
              invite works until {until}.
            </p>
            <SignInChoices path={path} newLabel="Create your diary" />
          </>
        ) : preview.own ? (
          <p className="mt-10 text-ink-2">
            This is your practice's own invite. Send it to the person you want to invite.{" "}
            <Link href="/practice" className={linkStyles}>
              Back to your practice
            </Link>
          </p>
        ) : (
          <div className="mt-10">
            <AcceptAsPersonForm
              who={practiceWho(practice)}
              shown={practiceLine(practice)}
              defaultName={profile?.displayName ?? ""}
              reportName={profile?.displayName ?? null}
              accept={acceptAsPerson.bind(null, code)}
            />
            <p className="mt-6 text-[0.9375rem] text-ink-3">
              Not now? Leave this page; the invite works until {until}.
            </p>
          </div>
        )}
      </Shell>
    );
  }

  const name = preview.personName;
  const practice = scope ? await scope.practice.get() : null;
  const seats = scope && practice ? await scope.practice.seats() : null;
  return (
    <Shell signedIn={signedIn}>
      <h1 className="text-title">
        {name ?? "Someone you see"}{" "}
        <span className="text-ink-soft">would like you to receive the reports they approve.</span>
      </h1>
      <ul className="mt-8 list-none space-y-3 border-t border-ink p-0 pt-5 text-ink-2">
        <li>
          When you accept, they confirm on their side that it is you. Then each report they approve and choose
          to share appears in your practice on sintr.
        </li>
        <li>You see the reports they share, and nothing else. They can stop at any time.</li>
      </ul>
      {!session ? (
        <>
          <p className="mt-8 text-[0.9375rem] text-ink-3">
            Sign in to accept it from your practice, or create an account and open a practice. The invite
            works until {until}.
          </p>
          <SignInChoices path={path} newLabel="Create an account" />
        </>
      ) : preview.own ? (
        <p className="mt-10 text-ink-2">
          This is your own invite. Send it to your therapist.{" "}
          <Link href="/sharing" className={linkStyles}>
            Back to Sharing
          </Link>
        </p>
      ) : (
        <div className="mt-10">
          <AcceptAsPracticeForm
            practice={practice && seats ? { who: practiceWho(practice), seats: seatsLine(seats) } : null}
            accept={acceptAsPractice.bind(null, code)}
          />
        </div>
      )}
    </Shell>
  );
}
