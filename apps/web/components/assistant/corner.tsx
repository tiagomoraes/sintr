"use client";

import { Button, cn } from "@sintr/ui";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { useMessages } from "@/components/language";
import { presenceOn } from "@/lib/assistant/where";
import { useLatest } from "@/lib/use-latest";
import { Composer } from "./composer";
import { ConversationLog } from "./conversation-log";
import { PoolDock } from "./pool-travel";
import { useAssistant } from "./provider";

/** The side list of the diary is there from this width (shell-nav.tsx); under it, the header holds the corner. */
const WIDE = "(min-width: 900px)";

function subscribeWide(change: () => void) {
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
}

/** Whether the side list shows; null while the page is still the server's (both places then render). */
function useWide(): boolean | null {
  return useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE).matches,
    () => null,
  );
}

/**
 * The conversation beside a page, on every page of the diary but the home.
 * Nothing here exists while there is no assistant, and nothing on the
 * practice's pages. The corner it opens from is `AssistantSpot`.
 */
export function AssistantCorner() {
  const a = useAssistant();
  const pathname = usePathname();
  if (!a.setup.ready || presenceOn(pathname) !== "corner") return null;
  return a.panel.open ? <AssistantPanel /> : null;
}

/**
 * The assistant's corner: a small round window of paper with the pool of
 * light in it, at the foot of the side list on a wide screen ("into a
 * sidebar"), and beside the Menu in the header of a phone. It never covers
 * a word of the page. A tap opens the conversation beside the page, and the
 * light travels there; the window stays, empty, and closes it again. What
 * the assistant is doing is in its name, and in a few words beside it on a
 * wide screen.
 */
export function AssistantSpot({ place }: { place: "rail" | "header" }) {
  const t = useMessages();
  const a = useAssistant();
  const pathname = usePathname();
  const wide = useWide();
  const button = useRef<HTMLButtonElement>(null);
  // Only the corner on screen holds the pool; before the page knows its width, both do.
  const shown = wide === null || wide === (place === "rail");
  const open = a.panel.open && !a.panel.closing;

  // Back from the conversation: focus returns to the corner it opened from.
  const focusBack = useLatest(() => {
    if (wide !== null && shown && a.takeFocus("corner")) button.current?.focus({ preventScroll: true });
  });
  useLayoutEffect(() => {
    if (!open) focusBack.current();
  }, [open, focusBack]);

  if (!a.setup.ready || presenceOn(pathname) !== "corner") return null;
  const doing = a.mood === "resting" ? null : t.home.status[a.mood];
  return (
    <button
      ref={button}
      type="button"
      onClick={open ? a.panel.hide : a.panel.show}
      aria-label={doing ? t.assistant.openWhile(doing) : t.assistant.open}
      aria-expanded={open}
      aria-controls={open ? "assistant-panel" : undefined}
      className={cn("sintr-spot", place === "rail" ? "sintr-spot--rail" : "sintr-spot--header")}
    >
      <span className="sintr-spot__window">
        {shown && !open ? <PoolDock poolClassName="[--pool-size:calc(var(--spot-size)*1.3)]" /> : null}
      </span>
      {place === "rail" ? (
        <span aria-hidden="true" className="sintr-spot__words">
          {t.assistant.open}
          <span className="sintr-spot__doing">{doing ?? t.assistant.hint}</span>
        </span>
      ) : null}
    </button>
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
              <p className="mt-1 font-serif text-[1.0625rem] italic text-ink-3">{a.setup.greeting}</p>
              <h2
                id="panel-question"
                className="mt-1 font-serif text-[clamp(1.75rem,1.4rem+1vw,2.125rem)] leading-[1.1] tracking-[-0.02em]"
              >
                {t.home.title}
              </h2>
              <p className="mt-3 max-w-[30em] text-[1rem] text-ink-2">{lede}</p>
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
