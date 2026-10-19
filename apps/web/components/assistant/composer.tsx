"use client";

import { Button, cn } from "@sintr/ui";
import Link from "next/link";
import { useEffect, useRef, type FormEvent, type KeyboardEvent } from "react";
import { useLanguage, useMessages } from "@/components/language";
import { PlanLine } from "@/components/talk/plan-notes";
import { SupportStrip } from "@/components/talk/support-strip";
import { VoiceBar, VoiceButton, VoiceNotes } from "@/components/talk/voice-controls";
import { MAX_MESSAGE_LENGTH } from "@/lib/chat";
import { formatNext } from "@/lib/plan";
import type { VoiceView } from "@/lib/voice/view";
import { PoolDock } from "./pool-travel";
import { useAssistant } from "./provider";

const LINK = "text-ink underline decoration-rule-strong underline-offset-[0.28em] hover:decoration-ink";

/**
 * Where the person speaks or writes: the box, Speak while it is empty (where
 * the thumb rests) and Send once there are words, the voice's own bar while
 * it listens, and under it the help lines. The same on the home (`room`) and
 * in the conversation beside a page (`panel`). Leaving it (another page, the
 * conversation closed) closes the microphone and keeps nothing heard.
 */
export function Composer({
  place,
  started: shown,
  className,
}: {
  place: "room" | "panel";
  /** Whether the conversation on screen has begun (a page may show its own for a moment); the shell's otherwise. */
  started?: boolean;
  className?: string;
}) {
  const t = useMessages();
  const a = useAssistant();
  const textarea = useRef<HTMLTextAreaElement | null>(null);
  const { setup, voice } = a;
  const listening = voice.phase === "listening" || voice.phase === "asking";
  const transcribing = voice.phase === "transcribing";
  const cancel = voice.cancel;

  // The microphone is open only while the conversation is in view.
  useEffect(() => () => cancel(), [cancel]);

  // The words heard are in the box: there to read and change. On a phone the keyboard waits for a tap.
  const heard = a.heard;
  useEffect(() => {
    if (heard && !window.matchMedia("(pointer: coarse)").matches)
      textarea.current?.focus({ preventScroll: true });
  }, [heard]);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (a.submit()) textarea.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  const room = place === "room";
  const started = shown ?? a.started;
  const centred = room && !started;

  return (
    <div className={className}>
      {room && started ? (
        // The pool comes down beside the box and says, in a few words, what it is doing.
        <div className="mb-2 flex h-10 items-center gap-1" aria-hidden="true">
          <PoolDock size={40} className="-ml-1" />
          {a.mood !== "resting" ? (
            <p className="sintr-fade text-caption text-ink-3">{t.home.status[a.mood]}</p>
          ) : null}
        </div>
      ) : null}
      {a.stopped ? (
        <p className="mb-3 text-[0.9375rem] text-ink-2">
          {t.home.paused}{" "}
          {room ? (
            <Link href="/home" onClick={a.restart} className={LINK}>
              {t.home.pausedLink}
            </Link>
          ) : (
            <button type="button" onClick={a.restart} className={cn(LINK, "cursor-pointer")}>
              {t.home.pausedLink}
            </button>
          )}{" "}
          {t.home.pausedAfter}
        </p>
      ) : null}
      {setup.ready ? null : (
        <p className="mb-3 text-[0.9375rem] text-ink-2">
          {t.home.noAssistant}{" "}
          <Link href="/settings?key=own#own-key" className={LINK}>
            {t.home.noAssistantLink}
          </Link>{" "}
          {t.home.noAssistantAfter}
        </p>
      )}
      <VoiceNotes
        problem={voice.problem}
        onDismiss={voice.dismiss}
        heard={a.heard !== null && a.input.trim() !== ""}
        onClear={() => {
          a.clearHeard();
          textarea.current?.focus();
        }}
      />
      {listening || transcribing ? (
        <VoiceBar phase={voice.phase} spokenMs={voice.spokenMs} onDone={voice.stop} onCancel={voice.cancel} />
      ) : (
        <form onSubmit={submit} className={cn("flex items-end gap-3", !setup.ready && "hidden")}>
          <label htmlFor={`${place}-message`} className="sr-only">
            {t.home.messageLabel}
          </label>
          <textarea
            id={`${place}-message`}
            ref={(element) => {
              textarea.current = element;
              a.composerRef(element);
            }}
            value={a.input}
            onChange={(event) => a.setInput(event.target.value)}
            onKeyDown={onKeyDown}
            rows={place === "panel" ? 1 : 2}
            maxLength={MAX_MESSAGE_LENGTH}
            placeholder={
              a.limited
                ? t.home.placeholder.atLimit
                : started
                  ? t.home.placeholder.next
                  : t.home.placeholder.first
            }
            className="block max-h-56 min-h-[52px] w-full flex-1 resize-none rounded-[22px] border border-rule-strong bg-paper px-[18px] py-3 font-sans text-[1rem] leading-[1.5] text-ink placeholder:text-ink-3 transition-[border-color] duration-300 [field-sizing:content] hover:border-ink-soft focus-visible:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          />
          {voice.canSpeak && a.input.trim() === "" && !a.busy ? (
            <VoiceButton onSpeak={voice.start} />
          ) : (
            <Button type="submit" disabled={a.busy || a.input.trim() === ""} className="shrink-0">
              {t.home.send}
            </Button>
          )}
        </form>
      )}
      <div
        className={cn(
          "mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1",
          centred ? "justify-center text-center" : "justify-between",
        )}
      >
        <SupportStrip />
        {room && !centred ? <p className="hidden text-caption text-ink-3 sm:block">{t.home.keys}</p> : null}
      </div>
      <div className={cn(centred && "text-center")}>
        {setup.ready && !a.stopped && voice.recordable ? (
          <VoiceAvailability voice={setup.voice} speaking={listening || transcribing} />
        ) : null}
        {setup.ready &&
        setup.source === "house" &&
        a.meter &&
        !(a.limited && !a.limitAnswered && !a.stopped) ? (
          // At the limit, before anything is sent, the notice above says it all.
          <PlanLine meter={a.meter} />
        ) : null}
        {setup.rehearsal ? <p className="mt-2 text-caption text-ink-3">{t.home.rehearsal}</p> : null}
      </div>
    </div>
  );
}

/** One quiet line about speaking: why it is not offered, that the month's time is used, or, while speaking, who hears it. */
function VoiceAvailability({ voice, speaking }: { voice: VoiceView; speaking: boolean }) {
  const t = useMessages();
  const { intl } = useLanguage();
  if (voice.kind === "limit")
    return <p className="mt-2 text-caption text-ink-3">{t.voice.limit(formatNext(voice.next, intl))}</p>;
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
