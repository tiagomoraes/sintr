import type { VoiceUnavailable } from "@sintr/agent/shapes";

/**
 * What a page may offer for speaking, never a key: ready (and how to send
 * the recording), not available (and why, in one line), or this month's
 * time used. Data only: the page words it (`t.voice`), in its own language.
 */
export type VoiceView =
  | {
      kind: "ready";
      /** Gemini cannot read what browsers record: send it as WAV. */
      wav: boolean;
      /** Seconds of speaking left this month on the house; null for no limit (or on one's own key). */
      secondsLeft: number | null;
      /** Who writes down what is said, as people are told: "OpenRouter", "Google". */
      heardBy: string;
    }
  | {
      kind: "unavailable";
      reason: VoiceUnavailable;
      /** The provider of the person's own key, to name it in the line. */
      provider: string | null;
    }
  | {
      kind: "limit";
      /** The day speaking starts again, YYYY-MM-DD: for `formatNext` in the page's language. */
      next: string;
    };
