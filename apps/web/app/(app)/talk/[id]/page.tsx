import { Button, linkStyles } from "@sintr/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/empty-state";
import { Conversation } from "@/components/talk/conversation";
import { SetupNotice } from "@/components/talk/setup-notice";
import { formatMoment } from "@/lib/format";
import type { ProposalView } from "@/lib/proposals";
import { assistantReady, loadMessages, proposalView } from "@/lib/server/assistant";
import { requireScope, runtime } from "@/lib/server/runtime";
import { deleteConversation } from "../actions";

export const metadata: Metadata = { title: "Talk" };

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { scope } = await requireScope();
  const conversation = await scope.conversations.get(id);
  if (!conversation) notFound();
  const [ready, profile, messages, proposals] = await Promise.all([
    assistantReady(scope),
    scope.profile.get(),
    loadMessages(scope, id),
    scope.proposals.list(id),
  ]);
  const locale = { language: profile.language, timezone: profile.timezone };
  const views: Record<string, ProposalView> = Object.fromEntries(
    proposals.map((p) => [p.id, proposalView(p)]),
  );

  return (
    <>
      <PageHeading title="Talk" />
      <div className="-mt-6 mb-8 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 md:-mt-10">
        <p className="font-serif italic text-ink-3">Started {formatMoment(conversation.createdAt, locale)}</p>
        <Link href="/talk" className={linkStyles}>
          New conversation
        </Link>
      </div>
      {ready ? null : (
        <div className="mb-10">
          <SetupNotice />
        </div>
      )}
      <Conversation
        conversationId={id}
        initialMessages={messages}
        initialProposals={views}
        locale={locale}
        rehearsal={runtime().config.fakeAgent}
      />
      <details className="group mt-14 border-t border-rule pt-6">
        <summary className="cursor-pointer list-none text-[0.9375rem] font-medium text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
          <span
            aria-hidden="true"
            className="mr-2.5 inline-block size-[7px] -translate-y-px rotate-[-45deg] border-b-[1.5px] border-r-[1.5px] border-current transition-transform duration-[400ms] group-open:rotate-45"
          />
          Delete this conversation
        </summary>
        <form action={deleteConversation.bind(null, id)} className="mt-4">
          <p className="max-w-[36em] text-[0.9375rem] text-ink-3">
            This removes its messages and any draft you did not save, for good. Entries and check-ins you
            saved from it stay in your diary.
          </p>
          <Button type="submit" variant="outline" size="sm" className="mt-4">
            Delete it
          </Button>
        </form>
      </details>
    </>
  );
}
