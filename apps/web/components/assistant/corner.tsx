"use client";

import { Button, Rise } from "@sintr/ui";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";
import { useMessages } from "@/components/language";
import { presenceOn } from "@/lib/assistant/where";
import { useLatest } from "@/lib/use-latest";
import { Composer } from "./composer";
import { ConversationLog } from "./conversation-log";
import { PoolDock } from "./pool-travel";
import { useAssistant } from "./provider";

/** A page scrolled down by more than this hides the corner on a phone until it scrolls back. */
const SCROLL_STEP = 8;

/**
 * The assistant on every page of the diary but the home: a small pool of
 * light in the corner that opens the same conversation beside the page,
 * without leaving it. Nothing here exists while there is no assistant, and
 * nothing on the practice's pages.
 */
export function AssistantCorner() {
  const a = useAssistant();
  const pathname = usePathname();
  if (!a.setup.ready || presenceOn(pathname) !== "corner") return null;
  return (
    <>
      {!a.panel.open || a.panel.closing ? <CornerLight /> : null}
      {a.panel.open ? <AssistantPanel /> : null}
    </>
  );
}

/**
 * The corner: the pool, settled in a small round window of paper, and over
 * it a round button of the same size that opens the conversation.
 * What the assistant is doing is in the button's name, and beside it in a
 * few words whenever it is doing something. On a phone it steps out of the
 * way while the page scrolls down, and comes back when it scrolls up.
 */
function CornerLight() {
  const t = useMessages();
  const a = useAssistant();
  const corner = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  // Back from the conversation: focus returns where it was.
  const focusIfAsked = useLatest(() => {
    if (a.takeFocus("corner")) button.current?.focus({ preventScroll: true });
  });
  useLayoutEffect(() => {
    focusIfAsked.current();
  }, [focusIfAsked]);

  useEffect(() => {
    const element = corner.current;
    if (!element) return;
    const phone = window.matchMedia("(max-width: 719px)");
    let last = window.scrollY;
    function onScroll() {
      const y = window.scrollY;
      const atEnd = window.innerHeight + y >= document.documentElement.scrollHeight - 48;
      if (!phone.matches || atEnd || y < 120 || last - y > SCROLL_STEP) {
        delete element!.dataset.away;
        last = y;
      } else if (y - last > SCROLL_STEP) {
        if (!element!.contains(document.activeElement)) element!.dataset.away = "true";
        last = y;
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const doing = a.mood === "resting" ? null : t.home.status[a.mood];
  return (
    <div ref={corner} className="sintr-corner" data-doing={doing ? "true" : undefined}>
      <div className="sintr-corner__light">
        <PoolDock poolClassName="[--pool-size:calc(var(--corner-size)*1.3)]" />
      </div>
      <button
        ref={button}
        type="button"
        onClick={a.panel.show}
        aria-label={doing ? t.assistant.openWhile(doing) : t.assistant.open}
        aria-expanded={false}
        aria-controls="assistant-panel"
        className="sintr-corner__button"
      >
        <span aria-hidden="true" className="sintr-corner__words">
          {doing ?? t.assistant.hint}
        </span>
      </button>
    </div>
  );
}

/**
 * The conversation beside a page: a panel on the right of a wide screen, a
 * sheet from the bottom of a phone. It is not modal: the page stays where
 * it was, readable and usable beside it, and focus can leave it. Escape
 * closes it (or first stops the microphone, while it listens), and focus
 * goes back to the corner.
 */
function AssistantPanel() {
  const t = useMessages();
  const a = useAssistant();
  const panel = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const closing = a.panel.closing;
  const started = a.messages.length > 0;
  const listening = a.voice.phase === "listening" || a.voice.phase === "asking";

  // Opened: the box on a desk, ready for words; on a phone the panel itself, so no keyboard jumps up.
  const focusIfAsked = useLatest(() => {
    if (!a.takeFocus("panel")) return;
    const box = panel.current?.querySelector<HTMLTextAreaElement>("textarea");
    if (box && !window.matchMedia("(pointer: coarse)").matches) box.focus({ preventScroll: true });
    else panel.current?.focus({ preventScroll: true });
  });
  useLayoutEffect(() => {
    focusIfAsked.current();
  }, [focusIfAsked]);

  const onKey = useLatest((event: KeyboardEvent) => {
    if (event.key !== "Escape" || event.defaultPrevented || event.isComposing) return;
    // The phone's menu is a dialog of its own and closes itself.
    if (event.target instanceof Element && event.target.closest("dialog")) return;
    event.preventDefault();
    if (listening) a.voice.cancel();
    else a.panel.hide();
  });
  useEffect(() => {
    if (closing) return;
    const listener = (event: KeyboardEvent) => onKey.current(event);
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, [closing, onKey]);

  // On a phone the keyboard takes the bottom of the screen: the sheet sits on it, never under it.
  useEffect(() => {
    const view = window.visualViewport;
    const element = panel.current;
    if (!view || !element) return;
    function fit() {
      const covered = Math.max(0, window.innerHeight - view!.height - view!.offsetTop);
      element!.style.setProperty("--keyboard", `${Math.round(covered)}px`);
      element!.style.setProperty("--visible", `${Math.round(view!.height)}px`);
    }
    fit();
    view.addEventListener("resize", fit);
    view.addEventListener("scroll", fit);
    return () => {
      view.removeEventListener("resize", fit);
      view.removeEventListener("scroll", fit);
    };
  }, []);

  const lede = a.limited
    ? t.home.ledeAtLimit
    : a.voice.canSpeak || !a.voice.recordable
      ? t.assistant.lede
      : t.assistant.ledeWriteOnly;
  const state = closing ? "closing" : "open";

  return (
    <>
      <div aria-hidden="true" className="sintr-panel-scrim" data-state={state} onClick={a.panel.hide} />
      <div
        ref={panel}
        id="assistant-panel"
        role="dialog"
        aria-modal="false"
        aria-label={t.assistant.open}
        tabIndex={-1}
        className="sintr-panel"
        data-state={state}
      >
        <div aria-hidden="true" className="sintr-panel__grip" />
        <div className="flex min-h-[60px] items-center gap-2 px-5 pt-3 min-[720px]:px-6">
          {started ? (
            closing ? (
              <span className="size-11 flex-none" />
            ) : (
              <PoolDock size={44} className="-ml-1.5" />
            )
          ) : null}
          <p className="line-clamp-2 min-w-0 flex-1 text-caption leading-[1.3] text-ink-3" aria-hidden="true">
            {started && a.mood !== "resting" ? t.home.status[a.mood] : ""}
          </p>
          {started ? (
            <Button
              type="button"
              variant="quiet"
              size="inline"
              onClick={a.restart}
              className="mr-2 text-[0.9375rem] underline decoration-rule-strong underline-offset-[0.28em]"
            >
              {t.home.newConversation}
            </Button>
          ) : null}
          <button
            type="button"
            onClick={a.panel.hide}
            className="inline-flex min-h-10 cursor-pointer items-center rounded-pill border border-rule bg-paper px-4 text-label font-medium text-ink-2 transition-colors duration-300 hover:border-rule-strong hover:text-ink"
          >
            {t.assistant.close}
          </button>
        </div>
        <div
          ref={scroller}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 min-[720px]:px-6"
        >
          {started ? null : (
            <section
              aria-labelledby="panel-question"
              className="flex flex-col items-center pb-6 pt-2 text-center"
            >
              {closing ? <span className="size-[112px]" /> : <PoolDock size={112} />}
              <Rise as="p" index={0} className="mt-1 font-serif text-[1.0625rem] italic text-ink-3">
                {a.setup.greeting}
              </Rise>
              <Rise index={1}>
                <h2
                  id="panel-question"
                  className="mt-1 font-serif text-[clamp(1.75rem,1.4rem+1vw,2.125rem)] leading-[1.1] tracking-[-0.02em]"
                >
                  {t.home.title}
                </h2>
              </Rise>
              <Rise as="p" index={2} className="mt-3 max-w-[30em] text-[1rem] text-ink-2">
                {lede}
              </Rise>
            </section>
          )}
          <ConversationLog
            messages={a.messages}
            proposals={a.proposals}
            scrollBox={scroller}
            className={started ? "pt-2" : "flex-none gap-0 pb-0 [&:has(>*:not(:last-child))]:pb-6"}
          />
        </div>
        <Composer
          place="panel"
          className="border-t border-rule bg-paper px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 min-[720px]:px-6"
        />
      </div>
    </>
  );
}
