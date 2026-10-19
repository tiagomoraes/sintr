import type { PoolMood } from "@sintr/ui";

/**
 * Speaking, as a small state machine with no browser in it, so every turn
 * of it can be tested: the person asks to speak, the microphone opens (or
 * is refused), they finish or cancel, what they said is written down, and
 * it lands in the box for them to read before anything is sent.
 */

export type VoicePhase = "idle" | "asking" | "listening" | "transcribing";

/** Why speaking did not give words this time; each has one plain sentence in the catalog. */
export type VoiceProblem =
  /** The browser or the person refused the microphone. */
  | "denied"
  /** There is no microphone to open. */
  | "no_microphone"
  /** Under a second: nothing was sent. */
  | "too_short"
  /** It was transcribed, and there were no words in it. */
  | "nothing_heard"
  /** The month's speaking time is used. */
  | "limit"
  /** The transcription failed; the person can try again or write. */
  | "failed";

export interface VoiceState {
  phase: VoicePhase;
  /** When the microphone opened (ms), while listening. */
  startedAt: number | null;
  problem: VoiceProblem | null;
}

export type VoiceEvent =
  | { type: "ask" }
  | { type: "granted"; at: number }
  | { type: "refused"; problem: "denied" | "no_microphone" | "failed" }
  | { type: "stop" }
  | { type: "cancel" }
  | { type: "heard"; text: string }
  | { type: "failed"; problem: VoiceProblem }
  | { type: "dismiss" };

export const IDLE: VoiceState = { phase: "idle", startedAt: null, problem: null };

export function voiceReducer(state: VoiceState, event: VoiceEvent): VoiceState {
  switch (event.type) {
    case "ask":
      return state.phase === "idle" ? { phase: "asking", startedAt: null, problem: null } : state;
    case "granted":
      return state.phase === "asking" ? { phase: "listening", startedAt: event.at, problem: null } : state;
    case "refused":
      return state.phase === "asking" ? { ...IDLE, problem: event.problem } : state;
    case "stop":
      return state.phase === "listening" ? { phase: "transcribing", startedAt: null, problem: null } : state;
    case "cancel":
      return state.phase === "asking" || state.phase === "listening" ? IDLE : state;
    case "heard":
      if (state.phase !== "transcribing") return state;
      return event.text.trim() ? IDLE : { ...IDLE, problem: "nothing_heard" };
    case "failed":
      return state.phase === "idle" ? state : { ...IDLE, problem: event.problem };
    case "dismiss":
      return state.problem ? { ...state, problem: null } : state;
  }
}

/** "0:07", "2:30": how long the person has been speaking. */
export function elapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * What the pool of light shows, from what is happening, most urgent first:
 * a paused diary is still; then the voice (listening, then writing down);
 * then the assistant at work; then a draft waiting for the person; and
 * otherwise it rests.
 */
export function poolMood(input: {
  voice: VoicePhase;
  /** The conversation's state, as the chat reports it. */
  chat: "ready" | "submitted" | "streaming" | "error";
  /** The diary stopped for a crisis in this conversation. */
  paused: boolean;
  /** A draft is on screen, not yet confirmed or discarded. */
  draftWaiting: boolean;
}): PoolMood {
  if (input.paused) return "paused";
  if (input.voice === "listening") return "listening";
  if (input.voice === "transcribing") return "transcribing";
  if (input.chat === "submitted" || input.chat === "streaming") return "thinking";
  if (input.draftWaiting) return "proposing";
  return "resting";
}
