import { Button, linkStyles } from "@sintr/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Conversation } from "@/components/talk/conversation";
import { formatMoment } from "@/lib/format";
import type { ProposalView } from "@/lib/proposals";
import { assistantState, loadMessages, proposalView } from "@/lib/server/assistant";
import { requireScope, runtime } from "@/lib/server/runtime";
import { voiceView } from "@/lib/server/voice";
import { t } from "@/messages";
import { deleteConversation } from "../actions";

export const metadata: Metadata = { title: t.shell.nav.home };

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { scope } = await requireScope();
  const conversation = await scope.conversations.get(id);
  if (!conversation) notFound();
  const [assistant, profile, messages, proposals, voice] = await Promise.all([
    assistantState(scope),
    scope.profile.get(),
    loadMessages(scope, id),
    scope.proposals.list(id),
    voiceView(scope),
  ]);
  const locale = { language: profile.language, timezone: profile.timezone };
  const views: Record<string, ProposalView> = Object.fromEntries(
    proposals.map((p) => [p.id, proposalView(p)]),
  );

  return (
    <>
      <h1 className="sr-only">{conversation.title ?? t.home.untitled}</h1>
      <div className="mb-10 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <p className="font-serif italic text-ink-3">
          {t.home.started(formatMoment(conversation.createdAt, locale))}
        </p>
        <Link href="/home" className={linkStyles}>
          {t.home.newConversation}
        </Link>
      </div>
      <Conversation
        conversationId={id}
        initialMessages={messages}
        initialProposals={views}
        locale={locale}
        rehearsal={runtime().config.fakeAgent}
        ready={assistant.kind !== "none"}
        source={assistant.kind === "house" ? "house" : "own"}
        meter={assistant.kind === "house" ? assistant.messages : null}
        voice={voice}
      />
      <details className="group mt-14 border-t border-rule pt-6">
        <summary className="cursor-pointer list-none text-[0.9375rem] font-medium text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
          <span
            aria-hidden="true"
            className="mr-2.5 inline-block size-[7px] -translate-y-px rotate-[-45deg] border-b-[1.5px] border-r-[1.5px] border-current transition-transform duration-[400ms] group-open:rotate-45"
          />
          {t.home.deleteTitle}
        </summary>
        <form action={deleteConversation.bind(null, id)} className="mt-4">
          <p className="max-w-[36em] text-[0.9375rem] text-ink-3">{t.home.deleteBody}</p>
          <Button type="submit" variant="outline" size="sm" className="mt-4">
            {t.home.deleteIt}
          </Button>
        </form>
      </details>
    </>
  );
}
