import { practiceLine, type InvitePreview } from "@sintr/core";
import { buttonVariants, linkStyles } from "@sintr/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { HeaderLink, SiteHeader } from "@/components/site-header";
import { AcceptAsPersonForm, AcceptAsPracticeForm } from "@/components/sharing/join-forms";
import { formatDay } from "@/lib/format";
import { InvitePromises } from "@/components/sharing/invite-promises";
import { joinPath, practiceDetails, practiceWho, seatsLine } from "@/lib/sharing";
import { tooManyLookups } from "@/lib/server/join";
import { currentLanguage, getMessages } from "@/lib/server/language";
import { getSession, runtime } from "@/lib/server/runtime";
import type { Messages } from "@/messages";
import { acceptAsPerson, acceptAsPractice } from "./actions";

type Words = Messages["sharing"]["join"];

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).sharing.join.title };
}

function Shell({ children, signedIn, t }: { children: React.ReactNode; signedIn: boolean; t: Words }) {
  return (
    <>
      <SiteHeader home={signedIn ? "/home" : "/"}>
        {signedIn ? (
          <HeaderLink href="/home">{t.diary}</HeaderLink>
        ) : (
          <HeaderLink href="/sign-in">{t.signIn}</HeaderLink>
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

function SignInChoices({ path, newLabel, haveLabel }: { path: string; newLabel: string; haveLabel: string }) {
  const next = encodeURIComponent(path);
  return (
    <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-4">
      <Link href={`/sign-up?next=${next}`} className={buttonVariants()}>
        {newLabel}
      </Link>
      <Link href={`/sign-in?next=${next}`} className={linkStyles}>
        {haveLabel}
      </Link>
    </div>
  );
}

function Invalid({ signedIn, busy, t }: { signedIn: boolean; busy: boolean; t: Words }) {
  return (
    <Shell signedIn={signedIn} t={t}>
      <h1 className="text-title">{busy ? t.busy.title : t.invalid.title}</h1>
      <p className="mt-4 text-lede text-ink-2">{busy ? t.busy.body : t.invalid.body}</p>
      <p className="mt-10">
        <Link href={signedIn ? "/home" : "/"} className={linkStyles}>
          {signedIn ? t.backToDiary : t.whatIs}
        </Link>
      </p>
    </Shell>
  );
}

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const session = await getSession();
  const signedIn = Boolean(session);
  const [messages, language] = await Promise.all([getMessages(), currentLanguage()]);
  const t = messages.sharing.join;
  if (await tooManyLookups()) return <Invalid signedIn={signedIn} busy t={t} />;
  const preview: InvitePreview = await runtime().repositories.previewInvite(code, session?.user.id ?? null);
  if (preview.status === "invalid") return <Invalid signedIn={signedIn} busy={false} t={t} />;
  const path = joinPath(code);
  const scope = session ? await runtime().repositories.forUser(session.user.id) : null;
  const profile = scope ? await scope.profile.get() : null;
  const until = formatDay(preview.expiresAt, {
    language: language.code,
    timezone: profile?.timezone ?? "UTC",
  });

  if (preview.direction === "practice_to_person") {
    const { practice } = preview;
    const details = practiceDetails(practice);
    const words = t.fromPractice;
    return (
      <Shell signedIn={signedIn} t={t}>
        <h1 className="text-title">
          {practice.professionalName} <span className="text-ink-soft">{words.heading}</span>
        </h1>
        <div className="mt-8 rounded-file border border-rule bg-paper px-5 py-4 shadow-card">
          <p className="font-serif text-title-small text-ink [overflow-wrap:anywhere]">
            {practice.professionalName}
          </p>
          {details ? <p className="mt-1 text-caption text-ink-3">{details}</p> : null}
        </div>
        <InvitePromises className="mt-8" />
        {!session ? (
          <>
            <p className="mt-8 text-[0.9375rem] text-ink-3">{words.signedOut(until)}</p>
            <SignInChoices path={path} newLabel={words.create} haveLabel={words.haveOne} />
          </>
        ) : preview.own ? (
          <p className="mt-10 text-ink-2">
            {words.own}{" "}
            <Link href="/practice" className={linkStyles}>
              {words.back}
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
            <p className="mt-6 text-[0.9375rem] text-ink-3">{words.notNow(until)}</p>
          </div>
        )}
      </Shell>
    );
  }

  const name = preview.personName;
  const practice = scope ? await scope.practice.get() : null;
  const seats = scope && practice ? await scope.practice.seats() : null;
  const words = t.fromPerson;
  return (
    <Shell signedIn={signedIn} t={t}>
      <h1 className="text-title">
        {name ?? words.someone} <span className="text-ink-soft">{words.heading}</span>
      </h1>
      <ul className="mt-8 list-none space-y-3 border-t border-ink p-0 pt-5 text-ink-2">
        <li>{words.accept}</li>
        <li>{words.only}</li>
      </ul>
      {!session ? (
        <>
          <p className="mt-8 text-[0.9375rem] text-ink-3">{words.signedOut(until)}</p>
          <SignInChoices path={path} newLabel={words.create} haveLabel={words.haveOne} />
        </>
      ) : preview.own ? (
        <p className="mt-10 text-ink-2">
          {words.own}{" "}
          <Link href="/sharing" className={linkStyles}>
            {words.back}
          </Link>
        </p>
      ) : (
        <div className="mt-10">
          <AcceptAsPracticeForm
            practice={
              practice && seats ? { who: practiceWho(practice), seats: seatsLine(seats, messages) } : null
            }
            accept={acceptAsPractice.bind(null, code)}
          />
        </div>
      )}
    </Shell>
  );
}
