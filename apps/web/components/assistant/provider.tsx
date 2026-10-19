"use client";

import { useChat } from "@ai-sdk/react";
import type { SintrUIMessage } from "@sintr/agent/shapes";
import type { PoolMood } from "@sintr/ui";
import { DefaultChatTransport } from "ai";
import { usePathname, useRouter } from "next/navigation";
import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useMessages } from "@/components/language";
import { presenceOn } from "@/lib/assistant/where";
import { atTheLimit, type MeterView } from "@/lib/plan";
import type { ProposalView } from "@/lib/proposals";
import { useHydrated } from "@/lib/use-hydrated";
import { poolMood, type VoicePhase, type VoiceProblem } from "@/lib/voice/state";
import { canRecord, useVoice, type Heard } from "@/lib/voice/use-voice";
import type { VoiceView } from "@/lib/voice/view";
import { PoolStage } from "./pool-travel";

/** What the diary's frame knows of the person's assistant, read on the server: never a key. */
export interface AssistantSetup {
  /** False while there is no assistant at all (a self-host before a key): no corner, and the home says how. */
  ready: boolean;
  /** Who answers: the person's own key, or the house assistant within their plan. */
  source: "own" | "house";
  /** This month's messages with the house assistant; null on the person's own key, which is never counted. */
  meter: MeterView | null;
  /** Whether the person can speak, and how. */
  voice: VoiceView;
  locale: { language: string; timezone: string };
  /** The offline, scripted assistant of the tests (SINTR_FAKE_AGENT). */
  rehearsal: boolean;
  /** "Good evening, Ana.", above the first question beside a page. */
  greeting: string;
}

/** A conversation as its page hands it over: what was said, and the decisions on its drafts. */
export interface Opened {
  id: string;
  messages: SintrUIMessage[];
  proposals: Record<string, ProposalView>;
}

export function textOf(message: SintrUIMessage): string {
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

/** After this long without a touch, a key or a scroll, the light stops moving until the next one. */
const IDLE_MS = 20_000;

/** The conversation opened beside a page: closing it plays out before it goes. */
const CLOSING_MS = 280;

type FocusRequest = "panel" | "corner";

export interface Assistant {
  setup: AssistantSetup;
  /** The conversation the diary is having now, on whichever page. */
  conversationId: string | null;
  messages: SintrUIMessage[];
  status: "ready" | "submitted" | "streaming" | "error";
  error: Error | undefined;
  proposals: Record<string, ProposalView>;
  setProposal: (id: string, view: ProposalView) => void;
  meter: MeterView | null;
  busy: boolean;
  /** Waiting for the first words of a reply. */
  waiting: boolean;
  /** The diary stopped for a crisis in this conversation. */
  stopped: boolean;
  started: boolean;
  limited: boolean;
  /** sintr has already answered for the limit, so the notice before it is not needed. */
  limitAnswered: boolean;
  mood: PoolMood;
  input: string;
  setInput: (text: string) => void;
  /** The words the transcriber heard, until the person changes or sends them. */
  heard: Heard | null;
  clearHeard: () => void;
  /** Send what is in the box; false when there was nothing to send. */
  submit: () => boolean;
  retry: () => void;
  voice: {
    phase: VoicePhase;
    problem: VoiceProblem | null;
    spokenMs: number;
    canSpeak: boolean;
    recordable: boolean;
    start: () => void;
    stop: () => void;
    cancel: () => void;
    dismiss: () => void;
  };
  /** Take up a conversation a page opened, unless it is the one already here. */
  open: (conversation: Opened) => void;
  /** A new conversation, empty; whatever is in the box stays there. */
  restart: () => void;
  /** The conversation beside a page (not on the home, which is the conversation). */
  panel: { open: boolean; closing: boolean; show: () => void; hide: () => void };
  /** The box the person writes in, wherever it is, so the words heard can be put there. */
  composerRef: (element: HTMLTextAreaElement | null) => void;
  /** Whether focus was asked for at `place` (and the request is then spent). */
  takeFocus: (place: FocusRequest) => boolean;
}

const AssistantContext = createContext<Assistant | null>(null);

export function useAssistant(): Assistant {
  const assistant = use(AssistantContext);
  if (!assistant) throw new Error("useAssistant needs the AssistantProvider of the diary's shell");
  return assistant;
}

/**
 * The assistant, as a resident of the whole diary rather than of one page.
 * It sits in the shell, which stays mounted while the person moves between
 * pages, so the conversation, the words in the box and the pool of light go
 * with them: on the home it is the page, everywhere else it waits in a
 * corner and opens beside the page. It is the same conversation everywhere,
 * and it knows nothing of the page it is on.
 */
export function AssistantProvider({ setup, children }: { setup: AssistantSetup; children: ReactNode }) {
  const t = useMessages();
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useHydrated();

  // A new chat for each conversation the shell takes up; the server keeps the record either way.
  const [session, setSession] = useState<{ generation: number; opened: Opened | null }>({
    generation: 0,
    opened: null,
  });
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [proposals, setProposals] = useState<Record<string, ProposalView>>({});
  // The meter as the conversation last reported it, until the frame is read again on the server.
  const [reported, setReported] = useState<{ base: MeterView | null; meter: MeterView } | null>(null);
  const meter = reported && reported.base === setup.meter ? reported.meter : setup.meter;
  const [input, setInput] = useState("");
  const [heard, setHeard] = useState<Heard | null>(null);
  // Read out once a reply is complete, instead of every streamed word.
  const [announcement, setAnnouncement] = useState("");
  const composer = useRef<HTMLTextAreaElement | null>(null);
  const focusRequest = useRef<FocusRequest | null>(null);

  const saved = useCallback(
    (status: ProposalView["status"]) => {
      // A draft confirmed beside a page: the page under it (a list of entries, a report) reads it again.
      if (status === "saved" && presenceOn(window.location.pathname) === "corner") router.refresh();
    },
    [router],
  );

  const chat = useChat<SintrUIMessage>({
    id: `${session.generation}:${session.opened?.id ?? "new"}`,
    messages: session.opened?.messages ?? [],
    transport,
    onFinish: ({ message }) => {
      if (message.role === "assistant") setAnnouncement(`${t.home.them}${textOf(message)}`);
    },
    onData: (part) => {
      if (part.type === "data-usage") {
        setReported({ base: setup.meter, meter: part.data });
      } else if (part.type === "data-limit") {
        setReported({
          base: setup.meter,
          meter: { used: part.data.limit ?? part.data.used, limit: part.data.limit, next: part.data.next },
        });
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
        setConversationId(part.data.conversationId);
        // On the home the conversation takes its own address; beside another page, the page keeps its own.
        if (presenceOn(window.location.pathname) === "room") {
          window.history.replaceState(null, "", `/talk/${part.data.conversationId}`);
        }
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
        saved(next);
      }
    },
  });
  const { messages, status, error, sendMessage, regenerate, clearError } = chat;

  const onHeard = useCallback((words: Heard) => {
    setInput((current) => (current.trim() ? `${current.trimEnd()} ${words.text}` : words.text));
    setHeard(words);
    composer.current?.focus();
  }, []);
  const conversationRef = useRef(conversationId);
  useEffect(() => {
    conversationRef.current = conversationId;
  }, [conversationId]);
  const currentConversation = useCallback(() => conversationRef.current, []);
  const speaking = useVoice({
    wav: setup.voice.kind === "ready" && setup.voice.wav,
    secondsLeft: setup.voice.kind === "ready" ? setup.voice.secondsLeft : null,
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
  const limitAnswered = last?.role === "assistant" && last.parts.some((p) => p.type === "data-limit");
  const started = messages.length > 0;
  const recordable = hydrated && canRecord();
  const canSpeak = setup.ready && !stopped && setup.voice.kind === "ready" && recordable && !speaking.spent;
  const mood = poolMood({
    voice: speaking.state.phase,
    chat: status,
    paused: stopped,
    draftWaiting: waitingDrafts(messages, proposals),
  });

  // The conversation beside a page. A new page closes it on a phone (the sheet gives way to the page)
  // and on the home (the conversation is the page there); on a wide screen it stays beside the next page.
  const [panel, setPanel] = useState({ open: false, closing: false, sheet: false, path: pathname });
  if (panel.path !== pathname) {
    const keep = panel.open && !panel.closing && !panel.sheet && presenceOn(pathname) === "corner";
    setPanel({ ...panel, open: keep, closing: false, path: pathname });
  }
  const closing = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback(() => {
    if (closing.current !== null) clearTimeout(closing.current);
    closing.current = null;
    focusRequest.current = "panel";
    const sheet = window.matchMedia("(max-width: 719px)").matches;
    setPanel((current) => ({ ...current, open: true, closing: false, sheet }));
  }, []);
  const cancelVoice = speaking.cancel;
  const hide = useCallback(() => {
    // The microphone is open only while the conversation is in view: closing it keeps nothing heard.
    cancelVoice();
    focusRequest.current = "corner";
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPanel((current) => ({ ...current, open: false, closing: false }));
      return;
    }
    setPanel((current) => (current.open ? { ...current, closing: true } : current));
    if (closing.current !== null) clearTimeout(closing.current);
    closing.current = setTimeout(() => {
      closing.current = null;
      setPanel((current) => (current.closing ? { ...current, open: false, closing: false } : current));
    }, CLOSING_MS);
  }, [cancelVoice]);
  useEffect(
    () => () => {
      if (closing.current !== null) clearTimeout(closing.current);
    },
    [],
  );

  const restart = useCallback(
    (opened: Opened | null) => {
      cancelVoice();
      setSession((current) => ({ generation: current.generation + 1, opened }));
      setConversationId(opened?.id ?? null);
      setProposals(opened?.proposals ?? {});
      setAnnouncement("");
    },
    [cancelVoice],
  );

  // While nothing happens, the light stops moving (no frame is drawn for it) until the person does something.
  const active = mood === "listening" || mood === "transcribing" || mood === "thinking";
  useEffect(() => {
    const root = document.documentElement;
    if (active) return;
    let timer = setTimeout(rest, IDLE_MS);
    let woken = 0;
    function rest() {
      root.dataset.idle = "true";
    }
    function wake() {
      const now = performance.now();
      if (root.dataset.idle === undefined && now - woken < 1000) return;
      woken = now;
      delete root.dataset.idle;
      clearTimeout(timer);
      timer = setTimeout(rest, IDLE_MS);
    }
    const events = ["pointerdown", "pointermove", "keydown", "wheel", "scroll", "touchstart", "focusin"];
    for (const name of events) window.addEventListener(name, wake, { capture: true, passive: true });
    document.addEventListener("visibilitychange", wake);
    return () => {
      clearTimeout(timer);
      for (const name of events) window.removeEventListener(name, wake, { capture: true });
      document.removeEventListener("visibilitychange", wake);
      delete root.dataset.idle;
    };
  }, [active]);

  const value: Assistant = {
    setup,
    conversationId,
    messages,
    status,
    error,
    proposals,
    setProposal: (id, view) => {
      setProposals((current) => ({ ...current, [id]: view }));
      saved(view.status);
    },
    meter,
    busy,
    waiting,
    stopped,
    started,
    limited,
    limitAnswered,
    mood,
    input,
    setInput: (text) => {
      setInput(text);
      if (text.trim() === "") setHeard(null);
    },
    heard,
    clearHeard: () => {
      setInput("");
      setHeard(null);
    },
    submit: () => {
      const text = input.trim() === "" ? "" : input;
      if (!text || busy) return false;
      setInput("");
      setHeard(null);
      void sendMessage({ text }, { body: conversationId ? { conversationId } : {} });
      return true;
    },
    retry: () => {
      clearError();
      void regenerate({ body: conversationId ? { conversationId } : {} });
    },
    voice: {
      phase: speaking.state.phase,
      problem: speaking.state.problem,
      spokenMs: speaking.spokenMs,
      canSpeak,
      recordable,
      start: speaking.start,
      stop: speaking.stop,
      cancel: speaking.cancel,
      dismiss: speaking.dismiss,
    },
    open: (conversation) => {
      if (conversation.id !== conversationId) restart(conversation);
    },
    restart: () => restart(null),
    panel: { open: panel.open, closing: panel.closing, show, hide },
    composerRef: (element) => {
      composer.current = element;
    },
    takeFocus: (place) => {
      if (focusRequest.current !== place) return false;
      focusRequest.current = null;
      return true;
    },
  };

  return (
    <AssistantContext value={value}>
      <PoolStage mood={mood} levelRef={speaking.levelRef}>
        {children}
      </PoolStage>
      {/* What the pool is doing, and each reply once complete, said once for the whole diary. */}
      <p className="sr-only" role="status">
        {setup.ready ? t.home.status[mood] : ""}
      </p>
      <p className="sr-only" role="status">
        {announcement}
      </p>
    </AssistantContext>
  );
}
