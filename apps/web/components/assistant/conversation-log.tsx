"use client";

import type { CheckinDraft, EntryDraft, SintrUIMessage } from "@sintr/agent/shapes";
import { Button, Panel, cn } from "@sintr/ui";
import Link from "next/link";
import { useEffect, useRef, type RefObject } from "react";
import { useMessages } from "@/components/language";
import { SupportLines } from "@/components/support-lines";
import { CrisisPanel } from "@/components/talk/crisis-panel";
import { LimitNotice } from "@/components/talk/plan-notes";
import { ProposalCard } from "@/components/talk/proposal-card";
import { needsSetup, problemText } from "@/lib/chat";
import { limitReplyText } from "@/lib/plan";
import type { ProposalView } from "@/lib/proposals";
import { textOf, useAssistant } from "./provider";

function Bubble({ from, children }: { from: "you" | "assistant"; children: string }) {
  const t = useMessages();
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
  const t = useMessages();
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

/**
 * The conversation as it is said: the person's words, the replies, the
 * drafts to confirm, the help lines when the diary stops. The same on the
 * home and beside a page. `live` is false only for the moment a page shows
 * a conversation the shell has not taken up yet (its first render); then
 * nothing of the shell's current exchange belongs here.
 */
export function ConversationLog({
  messages,
  proposals,
  live = true,
  scrollBox,
  className,
}: {
  messages: SintrUIMessage[];
  proposals: Record<string, ProposalView>;
  live?: boolean;
  /** The box that scrolls (the conversation beside a page); without it, the page scrolls. */
  scrollBox?: RefObject<HTMLElement | null>;
  className?: string;
}) {
  const t = useMessages();
  const a = useAssistant();
  const endRef = useRef<HTMLDivElement>(null);
  const locale = a.setup.locale;

  useEffect(() => {
    if (messages.length === 0) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const box = scrollBox?.current;
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: reduce ? "auto" : "smooth" });
    else endRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "end" });
  }, [messages, a.status, scrollBox]);

  const card = (proposalId: string, kind: "entry" | "checkin", draft: EntryDraft | CheckinDraft) => (
    <ProposalCard
      proposalId={proposalId}
      kind={kind}
      draft={draft}
      view={proposals[proposalId]}
      onView={(view) => a.setProposal(proposalId, view)}
      locale={locale}
    />
  );

  return (
    <div
      role="log"
      aria-label={t.home.log}
      aria-live="off"
      className={cn("flex flex-1 flex-col gap-3 pb-6", className)}
    >
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
                    <Bubble from="assistant">{limitReplyText(part.data, t)}</Bubble>
                    {kept ? <div className="py-2">{card(kept.proposalId, "entry", kept.draft)}</div> : null}
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
                    {card(proposalId, part.type === "tool-propose_entry" ? "entry" : "checkin", draft)}
                  </div>
                );
              }
              return null;
            })}
          </div>
        );
      })}
      {live ? (
        <>
          {a.waiting ? <Writing /> : null}
          {a.setup.ready && a.limited && !a.stopped && !a.limitAnswered && !a.busy && a.meter ? (
            <LimitNotice meter={a.meter} />
          ) : null}
          {a.error ? (
            <div className="rounded-file border border-rule bg-paper px-5 py-4" role="alert">
              <p className="text-[0.9375rem] text-ink">{problemText(a.error.message, t, a.setup.source)}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
                {needsSetup(a.error.message) ? null : (
                  <Button size="sm" variant="outline" onClick={a.retry}>
                    {t.home.tryAgain}
                  </Button>
                )}
                {a.setup.source === "own" ? (
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
          {a.heard?.risk && !a.stopped ? (
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
        </>
      ) : null}
      {/* Scrolled to with room for the composer that sits over the end. */}
      <div ref={endRef} className="scroll-mb-56" />
    </div>
  );
}
