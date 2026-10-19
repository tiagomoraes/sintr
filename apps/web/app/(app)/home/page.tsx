import { randomUUID } from "node:crypto";
import { linkStyles } from "@sintr/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { Conversation } from "@/components/talk/conversation";
import { SetupNotice } from "@/components/talk/setup-notice";
import { SupportStrip } from "@/components/talk/support-strip";
import { formatMoment } from "@/lib/format";
import { assistantState } from "@/lib/server/assistant";
import { requireScope, runtime } from "@/lib/server/runtime";
import { voiceView } from "@/lib/server/voice";
import { hourIn, partOfDay } from "@/lib/time-of-day";
import { currentLanguage, getMessages } from "@/lib/server/language";
import type { Messages } from "@/messages";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).shell.nav.home };
}

/** Everything else, one tap away, in a sentence rather than a menu. */
function Doors({ t }: { t: Messages }) {
  const door =
    "text-ink-2 underline decoration-rule-strong underline-offset-[0.28em] hover:text-ink hover:decoration-ink";
  return (
    <p className="text-[0.9688rem] text-ink-3">
      {t.home.doors.label}{" "}
      <Link href="/checkins/new" className={door}>
        {t.home.doors.checkin}
      </Link>
      {t.home.doors.between}
      <Link href="/reports" className={door}>
        {t.home.doors.report}
      </Link>
      {t.home.doors.last}
      <Link href="/entries" className={door}>
        {t.home.doors.entries}
      </Link>
      {t.home.doors.after}
    </p>
  );
}

/**
 * The home is the input: "Tell me what happened.", by voice or in writing,
 * and the assistant drafts. A person who has not finished the welcome is
 * offered the way back to it, once, quietly.
 */
export default async function HomePage() {
  const t = await getMessages();
  const { scope } = await requireScope();
  const [assistant, profile, conversations, voice] = await Promise.all([
    assistantState(scope),
    scope.profile.get(),
    scope.conversations.list(),
    voiceView(scope),
  ]);
  const earlier = conversations.filter((c) => c.lastMessageAt !== null).slice(0, 8);
  const locale = { language: (await currentLanguage()).code, timezone: profile.timezone };
  const greeting = t.home.greeting(partOfDay(hourIn(profile.timezone)), profile.preferredName);

  return (
    <>
      {profile.onboardedAt === null ? (
        <p className="mb-8 text-[0.9375rem] text-ink-3">
          {t.home.unfinished}{" "}
          <Link href="/welcome" className={linkStyles}>
            {t.home.unfinishedLink}
          </Link>
        </p>
      ) : null}
      {assistant.kind !== "none" ? (
        <Conversation
          // A new one each time the page is opened, even from a conversation
          // whose address the browser took over after its first message.
          key={randomUUID()}
          conversationId={null}
          initialMessages={[]}
          initialProposals={{}}
          locale={locale}
          rehearsal={runtime().config.fakeAgent}
          source={assistant.kind}
          meter={assistant.kind === "house" ? assistant.messages : null}
          voice={voice}
          greeting={greeting}
          doors={<Doors t={t} />}
        />
      ) : (
        <div className="space-y-8">
          <div>
            <p className="font-serif text-[1.1875rem] italic text-ink-3">{greeting}</p>
            <h1 className="mt-1 text-title">{t.home.title}</h1>
          </div>
          <SetupNotice />
          <SupportStrip />
        </div>
      )}
      {earlier.length > 0 ? (
        <section aria-labelledby="earlier-title" className="mt-16">
          <h2 id="earlier-title" className="font-serif text-title-small font-normal text-ink">
            {t.home.earlier}
          </h2>
          <ul className="mt-4 border-t border-rule">
            {earlier.map((conversation) => (
              <li key={conversation.id} className="border-b border-rule">
                <Link href={`/talk/${conversation.id}`} className="group block py-4 no-underline">
                  <span className="block font-serif italic text-ink-2">
                    {formatMoment(conversation.lastMessageAt ?? conversation.createdAt, locale)}
                  </span>
                  <span className="mt-0.5 block truncate text-ink group-hover:underline group-hover:decoration-rule-strong group-hover:underline-offset-[0.28em]">
                    {conversation.title ?? t.home.untitled}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
