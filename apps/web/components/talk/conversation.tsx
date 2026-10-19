"use client";

import { useChat } from "@ai-sdk/react";
import type { CheckinDraft, EntryDraft, SintrUIMessage } from "@sintr/agent/shapes";
import { Button, LightPool, Panel, Rise, cn } from "@sintr/ui";
import { DefaultChatTransport } from "ai";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { SupportLines } from "@/components/support-lines";
import { useRoomScene } from "@/components/shell-light";
import { MAX_MESSAGE_LENGTH, needsSetup, problemCopy } from "@/lib/chat";
import { atTheLimit, limitReplyText, type MeterView } from "@/lib/plan";
import type { ProposalView } from "@/lib/proposals";
import { useHydrated } from "@/lib/use-hydrated";
import { poolMood } from "@/lib/voice/state";
import { canRecord, useVoice, type Heard } from "@/lib/voice/use-voice";
import type { VoiceView } from "@/lib/voice/view";
import { t } from "@/messages";
import { CrisisPanel } from "./crisis-panel";
import { LimitNotice, PlanLine } from "./plan-notes";
import { ProposalCard } from "./proposal-card";
import { SupportStrip } from "./support-strip";
import { VoiceBar, VoiceButton, VoiceNotes } from "./voice-controls";

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
  /** Whether the person can speak here, and how. */
  voice?: VoiceView;
  /** "Good evening, Ana.", above the first question. */
  greeting?: string | null;
  /** Quiet ways elsewhere, under the first question. */
  doors?: ReactNode;
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
        <span className="sr-only">{from === "you" ? t.home.you : t.home.them}</span>
        {children}
      </p>
    </div>
  );
}

function Writing() {
  return (
    <div className="flex justify-start" role="status">
      <p className="m-0 inline-flex items-center gap-1.5 rounded-bubble rounded-bl-[6px] border border-rule bg-paper px-[18px] py-[15px]">
        <span className="sr-only">{t.home.writing}</span>
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

/** Drafts on screen that wait for the person: proposed by the assistant, or kept at the limit. */
function waitingDrafts(messages: SintrUIMessage[], proposals: Record<string, ProposalView>): boolean {
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    for (const part of message.parts) {
      let id: string | null = null;
      if (
        (part.type === "tool-propose_entry" || part.type === "tool-propose_checkin") &&
        part.state === "output-available" &&
        part.output.ok
      ) {
        id = (part.output as { proposalId: string }).proposalId;
      } else if (part.type === "data-limit" && part.data.kept) {
        id = part.data.kept.proposalId;
      }
      if (id && (proposals[id]?.status ?? "proposed") === "proposed") return true;
    }
  }
  return false;
}

/**
 * The home, which is the input. A new conversation opens on one question,
 * "Tell me what happened.", beside a pool of light that breathes; the
 * person speaks or writes. Speaking is written down and lands in the box
 * for them to read and change; nothing is sent until they send it. The
 * browser sends only the person's new words; the server keeps the
 * conversation (sealed), screens it for risk before any model, runs the
 * assistant and streams the reply. Drafts arrive as cards to confirm, edit
 * or discard, and the pool shows what is happening all along.
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
  voice = { kind: "unavailable", reason: "not_configured", provider: null },
  greeting = null,
  doors = null,
}: Props) {
  const [serverId, setServerId] = useState<string | null>(conversationId);
  const [meter, setMeter] = useState<MeterView | null>(initialMeter);
  const [proposals, setProposals] = useState(initialProposals);
  const [input, setInput] = useState("");
  // The words the transcriber heard, until the person changes or sends them.
  const [heard, setHeard] = useState<Heard | null>(null);
  // Read out once a reply is complete, instead of every streamed word.
  const [announcement, setAnnouncement] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hydrated = useHydrated();

  const { messages, sendMessage, status, error, regenerate, clearError } = useChat<SintrUIMessage>({
    ...(conversationId ? { id: conversationId } : {}),
    messages: initialMessages,
    transport,
    onFinish: ({ message }) => {
      if (message.role === "assistant") setAnnouncement(`${t.home.them}${textOf(message)}`);
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

  const onHeard = useCallback((words: Heard) => {
    setInput((current) => (current.trim() ? `${current.trimEnd()} ${words.text}` : words.text));
    setHeard(words);
    textareaRef.current?.focus();
  }, []);
  const conversationRef = useRef(serverId);
  useEffect(() => {
    conversationRef.current = serverId;
  }, [serverId]);
  const currentConversation = useCallback(() => conversationRef.current, []);
  const speaking = useVoice({
    wav: voice.kind === "ready" && voice.wav,
    secondsLeft: voice.kind === "ready" ? voice.secondsLeft : null,
    conversationId: currentConversation,
    onHeard,
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
  // Once sintr has answered for the limit, the reply itself says it; the notice is for before.
  const limitAnswered = last?.role === "assistant" && last.parts.some((p) => p.type === "data-limit");
  const started = messages.length > 0;
  const recordable = hydrated && canRecord();
  const canSpeak = ready && !stopped && voice.kind === "ready" && recordable && !speaking.spent;
  const listening = speaking.state.phase === "listening" || speaking.state.phase === "asking";
  const transcribing = speaking.state.phase === "transcribing";
  const mood = poolMood({
    voice: speaking.state.phase,
    chat: status,
    paused: stopped,
    draftWaiting: waitingDrafts(messages, proposals),
  });
  useRoomScene(listening || transcribing ? "listening" : started ? "conversation" : null);

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
    setHeard(null);
    void sendMessage({ text }, { body: serverId ? { conversationId: serverId } : {} });
    textareaRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  const lede = limited ? t.home.ledeAtLimit : canSpeak || !hydrated ? t.home.lede : t.home.ledeWriteOnly;

  return (
    <div className="flex min-h-[calc(100svh-220px)] flex-col">
      {started ? null : (
        <section
          aria-labelledby="talk-empty"
          className="grid items-center gap-x-10 gap-y-2 pb-8 md:grid-cols-[minmax(0,1fr)_auto] md:gap-y-6 md:pb-10 md:pt-6"
        >
          <div>
            {greeting ? (
              <Rise as="p" index={0} className="font-serif text-[1.1875rem] italic text-ink-3">
                {greeting}
              </Rise>
            ) : null}
            <Rise index={1}>
              <h1 id="talk-empty" className="mt-1 text-title">
                {t.home.title}
              </h1>
            </Rise>
            <Rise as="p" index={2} className="mt-4 max-w-[34em] text-lede text-ink-2">
              {lede}
            </Rise>
            {doors ? (
              <Rise index={3} className="mt-6">
                {doors}
              </Rise>
            ) : null}
          </div>
          <LightPool
            mood={mood}
            levelRef={speaking.levelRef}
            className="sintr-fade -order-1 mx-auto [--pool-size:120px] md:order-none md:mx-0 md:[--pool-size:216px]"
          />
        </section>
      )}

      <div role="log" aria-label={t.home.log} aria-live="off" className="flex flex-1 flex-col gap-3 pb-6">
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
        {ready && limited && !stopped && !limitAnswered && !busy && meter ? (
          <LimitNotice meter={meter} />
        ) : null}
        {error ? (
          <div className="rounded-file border border-rule bg-paper px-5 py-4" role="alert">
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
                  {t.home.tryAgain}
                </Button>
              )}
              {source === "own" ? (
                <Link
                  href="/settings"
                  className="text-[0.9375rem] text-ink-2 underline decoration-rule-strong underline-offset-[0.28em] hover:text-ink"
                >
                  {t.home.checkSettings}
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
        {heard?.risk && !stopped ? (
          // What was said may be about danger: the lines first, before anything is sent.
          <Panel
            className="border-ink px-[clamp(20px,4vw,30px)] py-7"
            role="region"
            aria-label={t.home.heardRisk}
          >
            <SupportLines headingLevel={3} />
            <p className="mt-5 border-t border-rule pt-4 text-[0.9375rem] text-ink-2">{t.home.heardRisk}</p>
          </Panel>
        ) : null}
        {/* Scrolled to with room for the composer that sits over the end. */}
        <div ref={endRef} className="scroll-mb-56" />
      </div>

      <div
        className={cn(
          "z-10 -mx-1 bg-paper px-1 pb-[max(20px,env(safe-area-inset-bottom))]",
          // Before the first word the composer follows the question; once there are words in it, or a
          // conversation, it stays in view with its Send.
          started || input.trim() !== "" ? "sticky bottom-0 border-t border-rule pt-3" : "mt-auto pt-2",
        )}
      >
        {started ? (
          // The pool comes down beside the box and says, in a few words, what it is doing.
          <div className="mb-2 flex h-8 items-center gap-1" aria-hidden="true">
            <LightPool mood={mood} levelRef={speaking.levelRef} className="-ml-1 [--pool-size:40px]" />
            {mood !== "resting" ? (
              <p className="sintr-fade text-caption text-ink-3">{t.home.status[mood]}</p>
            ) : null}
          </div>
        ) : null}
        <p className="sr-only" role="status">
          {t.home.status[mood]}
        </p>
        {stopped ? (
          <p className="mb-3 text-[0.9375rem] text-ink-2">
            {t.home.paused}{" "}
            <Link
              href="/home"
              className="text-ink underline decoration-rule-strong underline-offset-[0.28em] hover:decoration-ink"
            >
              {t.home.pausedLink}
            </Link>{" "}
            {t.home.pausedAfter}
          </p>
        ) : null}
        <p className="sr-only" role="status">
          {announcement}
        </p>
        {ready ? null : (
          <p className="mb-3 text-[0.9375rem] text-ink-2">
            {t.home.noAssistant}{" "}
            <Link
              href="/settings?key=own#own-key"
              className="text-ink underline decoration-rule-strong underline-offset-[0.28em] hover:decoration-ink"
            >
              {t.home.noAssistantLink}
            </Link>{" "}
            {t.home.noAssistantAfter}
          </p>
        )}
        <VoiceNotes
          problem={speaking.state.problem}
          onDismiss={speaking.dismiss}
          heard={heard !== null && input.trim() !== ""}
          onClear={() => {
            setInput("");
            setHeard(null);
            textareaRef.current?.focus();
          }}
        />
        {listening || transcribing ? (
          <VoiceBar
            phase={speaking.state.phase}
            spokenMs={speaking.spokenMs}
            onDone={speaking.stop}
            onCancel={speaking.cancel}
          />
        ) : (
          <form onSubmit={submit} className={cn("flex items-end gap-3", !ready && "hidden")}>
            <label htmlFor="talk-message" className="sr-only">
              {t.home.messageLabel}
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
                limited
                  ? t.home.placeholder.atLimit
                  : started
                    ? t.home.placeholder.next
                    : t.home.placeholder.first
              }
              className="block max-h-56 min-h-[52px] w-full flex-1 resize-none rounded-[22px] border border-rule-strong bg-paper px-[18px] py-3 font-sans text-[1rem] leading-[1.5] text-ink placeholder:text-ink-3 transition-[border-color] duration-300 [field-sizing:content] hover:border-ink-soft focus-visible:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            />
            {canSpeak && input.trim() === "" && !busy ? (
              <VoiceButton onSpeak={speaking.start} />
            ) : (
              <Button type="submit" disabled={busy || input.trim() === ""} className="shrink-0">
                {t.home.send}
              </Button>
            )}
          </form>
        )}
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <SupportStrip />
          <p className="hidden text-caption text-ink-3 sm:block">{t.home.keys}</p>
        </div>
        {ready && !stopped && hydrated && recordable ? (
          <VoiceAvailability voice={voice} speaking={listening || transcribing} />
        ) : null}
        {ready && source === "house" && meter && !(limited && !limitAnswered && !stopped) ? (
          // At the limit, before anything is sent, the notice above says it all.
          <PlanLine meter={meter} />
        ) : null}
        {rehearsal ? <p className="mt-2 text-caption text-ink-3">{t.home.rehearsal}</p> : null}
      </div>
    </div>
  );
}

/** One quiet line about speaking: why it is not offered, that the month's time is used, or, while speaking, who hears it. */
function VoiceAvailability({ voice, speaking }: { voice: VoiceView; speaking: boolean }) {
  if (voice.kind === "limit")
    return <p className="mt-2 text-caption text-ink-3">{t.voice.limit(voice.next)}</p>;
  if (voice.kind === "unavailable") {
    const line = t.voice.unavailable[voice.reason](voice.provider);
    return line ? <p className="mt-2 text-caption text-ink-3">{line}</p> : null;
  }
  const low = voice.secondsLeft !== null && voice.secondsLeft < 180;
  return (
    <>
      {/* Who hears it, said while the person speaks, before anything leaves the device. */}
      {speaking ? <p className="mt-2 text-caption text-ink-3">{t.voice.privacy(voice.heardBy)}</p> : null}
      {low ? (
        <p className="mt-2 text-caption text-ink-3">{t.voice.left(Math.ceil(voice.secondsLeft! / 60))}</p>
      ) : null}
    </>
  );
}
