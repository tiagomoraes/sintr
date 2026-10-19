"use client";

import { Button, Rise, cn } from "@sintr/ui";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, type ReactNode } from "react";
import { useMessages } from "@/components/language";
import { useRoomScene } from "@/components/shell-light";
import { useLatest } from "@/lib/use-latest";
import { SetupNotice } from "@/components/talk/setup-notice";
import { SupportStrip } from "@/components/talk/support-strip";
import { Composer } from "./composer";
import { ConversationLog } from "./conversation-log";
import { PoolDock } from "./pool-travel";
import { useAssistant, type Opened } from "./provider";

/**
 * The home: the assistant's own room. Before a word, the pool of light rests
 * in the middle of the page, large and calm, with the question under it and
 * the box under that (at the bottom of a phone, where the thumb is); the
 * quiet doors to everything else wait under the box. Once the person speaks
 * or writes, the conversation is the page and the pool travels down beside
 * the box. It is the shell's conversation: started beside another page, it
 * is here when the person comes home.
 */
export function AssistantRoom({
  greeting,
  doors,
  unfinished = null,
  opened,
  head = null,
  after = null,
}: {
  greeting: string;
  /** Quiet ways elsewhere, under the box. */
  doors: ReactNode;
  /** The way back to an unfinished welcome, once, above everything. */
  unfinished?: ReactNode;
  /** The conversation this page opened (`/talk/<id>`): the shell takes it up. */
  opened?: Opened;
  /** Above a conversation: when it began, and a new one; without it, a new one alone. */
  head?: ReactNode;
  /** Under a conversation (deleting it). */
  after?: ReactNode;
}) {
  const t = useMessages();
  const a = useAssistant();
  const pathname = usePathname();

  // Taken up before the first paint, so the page never shows another conversation first.
  const take = useLatest(() => {
    if (opened) a.open(opened);
  });
  const openedId = opened?.id;
  useLayoutEffect(() => {
    take.current();
  }, [openedId, take]);

  // Until then (the server's page, the first render), the conversation the page opened is shown as it is.
  const live = !opened || a.conversationId === opened.id;
  const messages = live ? a.messages : opened.messages;
  const proposals = live ? a.proposals : opened.proposals;
  const started = messages.length > 0;
  const listening = a.voice.phase === "listening" || a.voice.phase === "asking";
  useRoomScene(listening || a.voice.phase === "transcribing" ? "listening" : started ? "conversation" : null);

  // A conversation begun beside another page keeps its own address once it is on the home.
  const conversationId = a.conversationId;
  useEffect(() => {
    if (!opened && conversationId && started && pathname === "/home") {
      window.history.replaceState(null, "", `/talk/${conversationId}`);
    }
  }, [opened, conversationId, started, pathname]);

  if (!a.setup.ready && !started) {
    return (
      <div className="space-y-8">
        {unfinished}
        <div>
          <p className="font-serif text-[1.1875rem] italic text-ink-3">{greeting}</p>
          <h1 className="mt-1 text-title">{t.home.title}</h1>
        </div>
        <SetupNotice />
        <SupportStrip />
      </div>
    );
  }

  const lede = a.limited
    ? t.home.ledeAtLimit
    : a.voice.canSpeak || !a.voice.recordable
      ? t.home.lede
      : t.home.ledeWriteOnly;

  return (
    <div
      className={cn(
        "flex flex-col",
        started
          ? "min-h-[calc(100svh-200px)]"
          : "min-h-[calc(100svh-120px)] min-[900px]:min-h-[calc(100svh-230px)] md:justify-center",
      )}
    >
      {unfinished}
      {started
        ? (head ?? (
            <div className="mb-8 flex justify-end">
              <Button
                type="button"
                variant="quiet"
                size="inline"
                className="text-[0.9375rem] underline decoration-rule-strong underline-offset-[0.28em]"
                onClick={() => {
                  // The empty room opens at its top, where the pool will be.
                  window.scrollTo({ top: 0 });
                  a.restart();
                  if (window.location.pathname !== "/home") window.history.replaceState(null, "", "/home");
                }}
              >
                {t.home.newConversation}
              </Button>
            </div>
          ))
        : null}
      {started ? null : (
        <section aria-labelledby="talk-empty" className="flex flex-col items-center pb-6 text-center md:pb-2">
          {/* The pool, in the middle of its room. Kept out of the rising lines, so its place stays put. */}
          <PoolDock poolClassName="[--pool-size:168px] md:[--pool-size:232px]" className="sintr-fade" />
          <Rise as="p" index={0} className="mt-2 font-serif text-[1.1875rem] italic text-ink-3 md:mt-4">
            {greeting}
          </Rise>
          <Rise index={1}>
            <h1 id="talk-empty" className="mt-1 text-title">
              {t.home.title}
            </h1>
          </Rise>
          <Rise as="p" index={2} className="mt-4 max-w-[32em] text-lede text-ink-2">
            {lede}
          </Rise>
        </section>
      )}
      <ConversationLog
        messages={messages}
        proposals={proposals}
        live={live}
        className={started ? undefined : "flex-none gap-0 pb-0 [&:has(>*:not(:last-child))]:pb-6"}
      />
      <Composer
        place="room"
        started={started}
        className={cn(
          "z-10 -mx-1 bg-paper px-1 pb-[max(20px,env(safe-area-inset-bottom))]",
          started
            ? "sticky bottom-0 border-t border-rule pt-3"
            : cn(
                "mt-auto w-full max-w-[40rem] self-center pt-2 md:mt-8",
                // Once there are words in it, it stays in view with its Send.
                a.input.trim() !== "" && "sticky bottom-0",
              ),
        )}
      />
      {started ? null : (
        <div className="mx-auto mt-5 max-w-[40rem] pb-2 text-center">
          <Rise index={3}>{doors}</Rise>
        </div>
      )}
      {after}
    </div>
  );
}
