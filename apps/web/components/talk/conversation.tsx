"use client";

import { useChat } from "@ai-sdk/react";
import type { CheckinDraft, EntryDraft, SintrUIMessage } from "@sintr/agent/shapes";
import { Button, cn } from "@sintr/ui";
import { DefaultChatTransport } from "ai";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { MAX_MESSAGE_LENGTH, needsSetup, problemCopy } from "@/lib/chat";
import { atTheLimit, limitReplyText, type MeterView } from "@/lib/plan";
import type { ProposalView } from "@/lib/proposals";
import { CrisisPanel } from "./crisis-panel";
import { LimitNotice, PlanLine } from "./plan-notes";
import { ProposalCard } from "./proposal-card";
import { SupportStrip } from "./support-strip";

interface Props {
  /** Null for a new conversation: the server creates it on the first message. */
  conversationId: string | null;
  initialMessages: SintrUIMessage[];
  initialProposals: Record<string, ProposalView>;
  locale: { language: string; timezone: string };
  /** The offline, scripted assistant of the tests (SINTR_FAKE_AGENT). */
  rehearsal: boolean;
  /** False while there is no assistant: the conversation can be read, not continued. */
  ready?: boolean;
  /** Who answers: the person's own key, or the house assistant within their plan. */
  source?: "own" | "house";
  /** This month's messages with the house assistant; null on the person's own key, which is never counted. */
  meter?: MeterView | null;
}

function textOf(message: SintrUIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

/**
 * The browser sends only the person's new words, plus the conversation id
 * once the server has given one (passed with each send as `body`).
 */
const transport = new DefaultChatTransport<SintrUIMessage>({
  api: "/api/chat",
  prepareSendMessagesRequest: ({ messages, trigger, body }) => {
    const last = messages.at(-1);
    return {
      body: {
        ...body,
        trigger,
        ...(trigger === "submit-message" && last ? { text: textOf(last) } : {}),
      },
    };
  },
});

function Bubble({ from, children }: { from: "you" | "assistant"; children: string }) {
  return (
    <div className={cn("flex", from === "you" ? "justify-end" : "justify-start")}>
      <p
        className={cn(
          "m-0 max-w-[82%] whitespace-pre-wrap break-words px-[18px] py-[13px] text-[0.9688rem] leading-[1.5] max-[720px]:max-w-[92%]",
          from === "you"
            ? "rounded-bubble rounded-br-[6px] bg-wash text-ink"
            : "rounded-bubble rounded-bl-[6px] border border-rule bg-paper text-ink-2",
        )}
      >
        <span className="sr-only">{from === "you" ? "You: " : "sintr: "}</span>
        {children}
      </p>
    </div>
  );
}

function Writing() {
  return (
    <div className="flex justify-start" role="status">
      <p className="m-0 inline-flex items-center gap-1.5 rounded-bubble rounded-bl-[6px] border border-rule bg-paper px-[18px] py-[15px]">
        <span className="sr-only">sintr is writing</span>
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            aria-hidden="true"
            className="size-1.5 rounded-full bg-ink-soft motion-safe:animate-pulse"
            style={{ animationDelay: `${dot * 180}ms` }}
          />
        ))}
      </p>
    </div>
  );
}

/**
 * The capture conversation. The browser sends only the person's new words;
 * the server keeps the conversation (sealed), runs the assistant and streams
 * the reply. Drafts arrive as cards to confirm, edit or discard.
 */
export function Conversation({
  conversationId,
  initialMessages,
  initialProposals,
  locale,
  rehearsal,
  ready = true,
  source = "own",
  meter: initialMeter = null,
}: Props) {
  const [serverId, setServerId] = useState<string | null>(conversationId);
  const [meter, setMeter] = useState<MeterView | null>(initialMeter);
  const [proposals, setProposals] = useState(initialProposals);
  const [input, setInput] = useState("");
  // Read out once a reply is complete, instead of every streamed word.
  const [announcement, setAnnouncement] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { messages, sendMessage, status, error, regenerate, clearError } = useChat<SintrUIMessage>({
    ...(conversationId ? { id: conversationId } : {}),
    messages: initialMessages,
    transport,
    onFinish: ({ message }) => {
      if (message.role === "assistant") setAnnouncement(`sintr: ${textOf(message)}`);
    },
    onData: (part) => {
      if (part.type === "data-usage") {
        setMeter(part.data);
      } else if (part.type === "data-limit") {
        setMeter({ used: part.data.limit ?? part.data.used, limit: part.data.limit, next: part.data.next });
        const kept = part.data.kept;
        if (kept) {
          setProposals((current) => ({
            ...current,
            [kept.proposalId]: current[kept.proposalId] ?? {
              kind: "entry",
              status: "proposed",
              recordId: null,
              edited: false,
              payload: null,
            },
          }));
        }
      } else if (part.type === "data-conversation") {
        setServerId(part.data.conversationId);
        window.history.replaceState(null, "", `/talk/${part.data.conversationId}`);
      } else if (part.type === "data-proposal") {
        const { proposalId, status: next, recordId } = part.data;
        setProposals((current) => ({
          ...current,
          [proposalId]: {
            kind: current[proposalId]?.kind ?? "entry",
            edited: current[proposalId]?.edited ?? false,
            payload: current[proposalId]?.payload ?? null,
            status: next,
            recordId,
          },
        }));
      }
    },
  });

  const busy = status === "submitted" || status === "streaming";
  const stopped = messages.some(
    (m) => m.role === "assistant" && m.parts.some((p) => p.type === "data-crisis"),
  );
  const last = messages.at(-1);
  const waiting =
    busy &&
    (last?.role !== "assistant" ||
      (textOf(last).length === 0 && !last.parts.some((p) => p.type === "data-limit")));
  const limited = meter !== null && atTheLimit(meter);

  useEffect(() => {
    if (messages.length === 0) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    endRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "end" });
  }, [messages, status]);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const text = input.trim() === "" ? "" : input;
    if (!text || busy) return;
    setInput("");
    void sendMessage({ text }, { body: serverId ? { conversationId: serverId } : {} });
    textareaRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex min-h-[calc(100svh-260px)] flex-col">
      {messages.length === 0 ? (
        <section aria-labelledby="talk-empty" className="pb-10 pt-2">
          <h1 id="talk-empty" className="text-title">
            Tell me what happened.
          </h1>
          <p className="mt-4 max-w-[34em] text-lede text-ink-2">
            In your own words, as much or as little as you want. I will listen, ask a question or two, and
            draft an entry for you to check. Nothing is kept as an entry until you confirm it.
          </p>
        </section>
      ) : null}

      <div role="log" aria-label="Conversation" aria-live="off" className="flex flex-1 flex-col gap-3 pb-6">
        {messages.map((message) => {
          if (message.role === "user") {
            return (
              <Bubble key={message.id} from="you">
                {textOf(message)}
              </Bubble>
            );
          }
          return (
            <div key={message.id} className="flex flex-col gap-3">
              {message.parts.map((part, index) => {
                const key = `${message.id}-${index}`;
                if (part.type === "text") {
                  return part.text.trim() ? (
                    <Bubble key={key} from="assistant">
                      {part.text}
                    </Bubble>
                  ) : null;
                }
                if (part.type === "data-crisis") {
                  return (
                    <div key={key} className="py-2">
                      <CrisisPanel />
                    </div>
                  );
                }
                if (part.type === "data-limit") {
                  const kept = part.data.kept;
                  return (
                    <div key={key} className="flex flex-col gap-3">
                      <Bubble from="assistant">{limitReplyText(part.data)}</Bubble>
                      {kept ? (
                        <div className="py-2">
                          <ProposalCard
                            proposalId={kept.proposalId}
                            kind="entry"
                            draft={kept.draft}
                            view={proposals[kept.proposalId]}
                            onView={(view) =>
                              setProposals((current) => ({ ...current, [kept.proposalId]: view }))
                            }
                            locale={locale}
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                }
                if (
                  (part.type === "tool-propose_entry" || part.type === "tool-propose_checkin") &&
                  part.state === "output-available" &&
                  part.output.ok
                ) {
                  const { proposalId, draft } = part.output as {
                    proposalId: string;
                    draft: EntryDraft | CheckinDraft;
                  };
                  return (
                    <div key={key} className="py-2">
                      <ProposalCard
                        proposalId={proposalId}
                        kind={part.type === "tool-propose_entry" ? "entry" : "checkin"}
                        draft={draft}
                        view={proposals[proposalId]}
                        onView={(view) => setProposals((current) => ({ ...current, [proposalId]: view }))}
                        locale={locale}
                      />
                    </div>
                  );
                }
                return null;
              })}
            </div>
          );
        })}
        {waiting ? <Writing /> : null}
        {error ? (
          <div className="rounded-file border border-rule px-5 py-4" role="alert">
            <p className="text-[0.9375rem] text-ink">{problemCopy(error.message, source)}</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
              {needsSetup(error.message) ? null : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    clearError();
                    void regenerate({ body: serverId ? { conversationId: serverId } : {} });
                  }}
                >
                  Try again
                </Button>
              )}
              {source === "own" ? (
                <Link
                  href="/settings"
                  className="text-[0.9375rem] text-ink-2 underline decoration-rule-strong underline-offset-[0.28em] hover:text-ink"
                >
                  Check the assistant in Settings
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
        {/* Scrolled to with room for the composer that sits over the end. */}
        <div ref={endRef} className="scroll-mb-56" />
      </div>

      <div className="sticky bottom-0 z-10 -mx-1 border-t border-rule bg-paper px-1 pb-5 pt-4">
        {stopped ? (
          <p className="mb-3 text-[0.9375rem] text-ink-2">
            The diary is paused here.{" "}
            <Link
              href="/talk"
              className="text-ink underline decoration-rule-strong underline-offset-[0.28em] hover:decoration-ink"
            >
              Start a new conversation
            </Link>{" "}
            whenever you are ready.
          </p>
        ) : null}
        <p className="sr-only" role="status">
          {announcement}
        </p>
        {ready ? null : (
          <p className="mb-3 text-[0.9375rem] text-ink-2">
            This sintr has no assistant of its own. Use your own key in{" "}
            <Link
              href="/settings?key=own#own-key"
              className="text-ink underline decoration-rule-strong underline-offset-[0.28em] hover:decoration-ink"
            >
              Settings
            </Link>{" "}
            to continue this conversation.
          </p>
        )}
        {ready && limited && !stopped && meter ? <LimitNotice meter={meter} /> : null}
        <form onSubmit={submit} className={cn("flex items-end gap-3", !ready && "hidden")}>
          <label htmlFor="talk-message" className="sr-only">
            Your message
          </label>
          <textarea
            id="talk-message"
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            maxLength={MAX_MESSAGE_LENGTH}
            placeholder={
              limited ? "Write what happened" : messages.length === 0 ? "What happened?" : "Write here"
            }
            className="block max-h-56 min-h-[52px] w-full flex-1 resize-none rounded-[22px] border border-rule-strong bg-paper px-[18px] py-3 font-sans text-[1rem] leading-[1.5] text-ink placeholder:text-ink-3 transition-[border-color] duration-300 [field-sizing:content] hover:border-ink-soft focus-visible:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          />
          <Button type="submit" disabled={busy || input.trim() === ""} className="shrink-0">
            Send
          </Button>
        </form>
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <SupportStrip />
          <p className="hidden text-caption text-ink-3 sm:block">
            Enter sends. Shift and Enter for a new line.
          </p>
        </div>
        {ready && source === "house" && meter ? <PlanLine meter={meter} /> : null}
        {rehearsal ? (
          <p className="mt-2 text-caption text-ink-3">
            Rehearsal mode: replies come from a scripted, offline assistant (SINTR_FAKE_AGENT). Nothing is
            sent to a provider.
          </p>
        ) : null}
      </div>
    </div>
  );
}
