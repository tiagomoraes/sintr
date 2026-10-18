import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { Conversation } from "@/components/talk/conversation";
import { SetupNotice } from "@/components/talk/setup-notice";
import { SupportStrip } from "@/components/talk/support-strip";
import { formatMoment } from "@/lib/format";
import { assistantReady } from "@/lib/server/assistant";
import { requireScope, runtime } from "@/lib/server/runtime";

export const metadata: Metadata = { title: "Talk" };

export default async function TalkPage() {
  const { scope } = await requireScope();
  const [ready, profile, conversations] = await Promise.all([
    assistantReady(scope),
    scope.profile.get(),
    scope.conversations.list(),
  ]);
  const earlier = conversations.filter((c) => c.lastMessageAt !== null).slice(0, 8);
  const locale = { language: profile.language, timezone: profile.timezone };

  return (
    <>
      {ready ? (
        <Conversation
          // A new one each time the page is opened, even from a conversation
          // whose address the browser took over after its first message.
          key={randomUUID()}
          conversationId={null}
          initialMessages={[]}
          initialProposals={{}}
          locale={locale}
          rehearsal={runtime().config.fakeAgent}
        />
      ) : (
        <div className="space-y-8">
          <h1 className="text-title">Talk</h1>
          <SetupNotice />
          <SupportStrip />
        </div>
      )}
      {earlier.length > 0 ? (
        <section aria-labelledby="earlier-title" className="mt-16">
          <h2 id="earlier-title" className="font-serif text-title-small font-normal text-ink">
            Earlier conversations
          </h2>
          <ul className="mt-4 border-t border-rule">
            {earlier.map((conversation) => (
              <li key={conversation.id} className="border-b border-rule">
                <Link href={`/talk/${conversation.id}`} className="group block py-4 no-underline">
                  <span className="block font-serif italic text-ink-2">
                    {formatMoment(conversation.lastMessageAt ?? conversation.createdAt, locale)}
                  </span>
                  <span className="mt-0.5 block truncate text-ink group-hover:underline group-hover:decoration-rule-strong group-hover:underline-offset-[0.28em]">
                    {conversation.title ?? "A conversation"}
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
