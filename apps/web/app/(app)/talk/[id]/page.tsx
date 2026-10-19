import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DeleteConversationForm, NewConversationLink } from "@/components/assistant/conversation-tools";
import { AssistantRoom } from "@/components/assistant/room";
import { formatMoment } from "@/lib/format";
import type { ProposalView } from "@/lib/proposals";
import { loadMessages, proposalView } from "@/lib/server/assistant";
import { requireScope } from "@/lib/server/runtime";
import { hourIn, partOfDay } from "@/lib/time-of-day";
import { currentLanguage, getMessages } from "@/lib/server/language";
import { deleteConversation } from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).shell.nav.home };
}

/**
 * A conversation, opened again: the shell takes it up, so it goes on from
 * here and follows the person to every page, and the home's room shows it.
 */
export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getMessages();
  const { id } = await params;
  const { scope } = await requireScope();
  const conversation = await scope.conversations.get(id);
  if (!conversation) notFound();
  const [profile, messages, proposals] = await Promise.all([
    scope.profile.get(),
    loadMessages(scope, id),
    scope.proposals.list(id),
  ]);
  const locale = { language: (await currentLanguage()).code, timezone: profile.timezone };
  const views: Record<string, ProposalView> = Object.fromEntries(
    proposals.map((p) => [p.id, proposalView(p)]),
  );

  return (
    <>
      <h1 className="sr-only">{conversation.title ?? t.home.untitled}</h1>
      <AssistantRoom
        greeting={t.home.greeting(partOfDay(hourIn(profile.timezone)), profile.preferredName)}
        doors={null}
        opened={{ id, messages, proposals: views }}
        head={
          <div className="mb-10 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <p className="font-serif italic text-ink-3">
              {t.home.started(formatMoment(conversation.createdAt, locale))}
            </p>
            <NewConversationLink />
          </div>
        }
        after={
          <details className="group mt-14 border-t border-rule pt-6">
            <summary className="cursor-pointer list-none text-[0.9375rem] font-medium text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
              <span
                aria-hidden="true"
                className="mr-2.5 inline-block size-[7px] -translate-y-px rotate-[-45deg] border-b-[1.5px] border-r-[1.5px] border-current transition-transform duration-[400ms] group-open:rotate-45"
              />
              {t.home.deleteTitle}
            </summary>
            <DeleteConversationForm action={deleteConversation.bind(null, id)} />
          </details>
        }
      />
    </>
  );
}
