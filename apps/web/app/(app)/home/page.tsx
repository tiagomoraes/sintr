import { linkStyles } from "@sintr/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { AssistantRoom } from "@/components/assistant/room";
import { formatMoment } from "@/lib/format";
import { requireScope } from "@/lib/server/runtime";
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
 * The home is the assistant's room: the pool of light in the middle, "Tell
 * me what happened.", by voice or in writing, and the assistant drafts. The
 * conversation itself lives in the shell (it follows the person to every
 * page); this page gives it its room, the doors, and the earlier
 * conversations below. A person who has not finished the welcome is offered
 * the way back to it, once, quietly.
 */
export default async function HomePage() {
  const t = await getMessages();
  const { scope } = await requireScope();
  const [profile, conversations] = await Promise.all([scope.profile.get(), scope.conversations.list()]);
  const earlier = conversations.filter((c) => c.lastMessageAt !== null).slice(0, 8);
  const locale = { language: (await currentLanguage()).code, timezone: profile.timezone };
  const greeting = t.home.greeting(partOfDay(hourIn(profile.timezone)), profile.preferredName);

  return (
    <>
      <AssistantRoom
        greeting={greeting}
        doors={<Doors t={t} />}
        unfinished={
          profile.onboardedAt === null ? (
            <p className="mb-8 text-center text-[0.9375rem] text-ink-3">
              {t.home.unfinished}{" "}
              <Link href="/welcome" className={linkStyles}>
                {t.home.unfinishedLink}
              </Link>
            </p>
          ) : null
        }
      />
      {earlier.length > 0 ? (
        <section aria-labelledby="earlier-title" className="mx-auto mt-20 max-w-[40rem]">
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
