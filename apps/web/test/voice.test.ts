import { describe, expect, it } from "vitest";
import { IDLE, elapsed, poolMood, voiceReducer, type VoiceEvent, type VoiceState } from "@/lib/voice/state";
import { SPEECH_RATE, encodeWav } from "@/lib/voice/wav";

/** Play events from rest; the state after each one. */
function play(...events: VoiceEvent[]): VoiceState[] {
  const states: VoiceState[] = [];
  let state = IDLE;
  for (const event of events) {
    state = voiceReducer(state, event);
    states.push(state);
  }
  return states;
}

describe("speaking, step by step", () => {
  it("asks, listens, writes it down, and rests again with the words handed over", () => {
    const states = play(
      { type: "ask" },
      { type: "granted", at: 1000 },
      { type: "stop" },
      { type: "heard", text: "Fui à reunião de segunda." },
    );
    expect(states.map((s) => s.phase)).toEqual(["asking", "listening", "transcribing", "idle"]);
    expect(states[1]).toEqual({ phase: "listening", startedAt: 1000, problem: null });
    expect(states.at(-1)).toEqual(IDLE);
  });

  it("says why when the microphone is refused, and lets the person try again", () => {
    const [, refused] = play({ type: "ask" }, { type: "refused", problem: "denied" });
    expect(refused).toEqual({ phase: "idle", startedAt: null, problem: "denied" });
    expect(voiceReducer(refused!, { type: "ask" })).toEqual({
      phase: "asking",
      startedAt: null,
      problem: null,
    });
    expect(voiceReducer(refused!, { type: "dismiss" })).toEqual(IDLE);
  });

  it("keeps nothing on Cancel, while asking or listening", () => {
    expect(play({ type: "ask" }, { type: "cancel" }).at(-1)).toEqual(IDLE);
    expect(play({ type: "ask" }, { type: "granted", at: 5 }, { type: "cancel" }).at(-1)).toEqual(IDLE);
  });

  it("tells a recording with no words, a failure and the month's limit apart", () => {
    const listening = play({ type: "ask" }, { type: "granted", at: 5 }, { type: "stop" }).at(-1)!;
    expect(voiceReducer(listening, { type: "heard", text: "   " }).problem).toBe("nothing_heard");
    expect(voiceReducer(listening, { type: "failed", problem: "failed" }).problem).toBe("failed");
    expect(voiceReducer(listening, { type: "failed", problem: "limit" })).toEqual({
      ...IDLE,
      problem: "limit",
    });
    const tooShort = play(
      { type: "ask" },
      { type: "granted", at: 5 },
      { type: "failed", problem: "too_short" },
    );
    expect(tooShort.at(-1)).toEqual({ ...IDLE, problem: "too_short" });
  });

  it("ignores what cannot happen in the state it is in", () => {
    // Done before the microphone opened, words with nothing being written down, a second ask while listening.
    expect(voiceReducer({ phase: "asking", startedAt: null, problem: null }, { type: "stop" }).phase).toBe(
      "asking",
    );
    expect(voiceReducer(IDLE, { type: "heard", text: "late words" })).toBe(IDLE);
    const listening: VoiceState = { phase: "listening", startedAt: 9, problem: null };
    expect(voiceReducer(listening, { type: "ask" })).toBe(listening);
    expect(voiceReducer(listening, { type: "granted", at: 99 })).toBe(listening);
    expect(voiceReducer(IDLE, { type: "failed", problem: "failed" })).toBe(IDLE);
    expect(voiceReducer(IDLE, { type: "dismiss" })).toBe(IDLE);
  });

  it("shows the time spoken as minutes and seconds", () => {
    expect(elapsed(0)).toBe("0:00");
    expect(elapsed(7_400)).toBe("0:07");
    expect(elapsed(150_000)).toBe("2:30");
    expect(elapsed(-50)).toBe("0:00");
  });
});

describe("the pool of light", () => {
  const rest = { voice: "idle", chat: "ready", paused: false, draftWaiting: false } as const;

  it("rests when nothing is happening", () => {
    expect(poolMood(rest)).toBe("resting");
    expect(poolMood({ ...rest, chat: "error" })).toBe("resting");
  });

  it("listens, then writes down, while the person speaks", () => {
    expect(poolMood({ ...rest, voice: "listening" })).toBe("listening");
    expect(poolMood({ ...rest, voice: "transcribing" })).toBe("transcribing");
    // Asking for the microphone is not listening yet.
    expect(poolMood({ ...rest, voice: "asking" })).toBe("resting");
  });

  it("thinks while the assistant answers, and warms when a draft waits", () => {
    expect(poolMood({ ...rest, chat: "submitted" })).toBe("thinking");
    expect(poolMood({ ...rest, chat: "streaming" })).toBe("thinking");
    expect(poolMood({ ...rest, draftWaiting: true })).toBe("proposing");
    // A new answer on its way comes before the draft already on screen.
    expect(poolMood({ ...rest, chat: "streaming", draftWaiting: true })).toBe("thinking");
  });

  it("puts the voice before everything but a paused diary", () => {
    expect(poolMood({ ...rest, voice: "listening", chat: "streaming", draftWaiting: true })).toBe(
      "listening",
    );
    expect(poolMood({ voice: "listening", chat: "streaming", paused: true, draftWaiting: true })).toBe(
      "paused",
    );
  });
});

describe("speech as WAV, for a provider that cannot read what browsers record", () => {
  it("is a 16-bit mono file at the rate speech is heard at", () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1, -1, 2]);
    const file = encodeWav(samples);
    const view = new DataView(file.buffer);
    const text = (offset: number, length: number) =>
      String.fromCharCode(...Array.from(file.slice(offset, offset + length)));
    expect(text(0, 4)).toBe("RIFF");
    expect(text(8, 4)).toBe("WAVE");
    expect(text(36, 4)).toBe("data");
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(SPEECH_RATE);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(samples.length * 2);
    expect(file.byteLength).toBe(44 + samples.length * 2);
    const sample = (i: number) => view.getInt16(44 + i * 2, true);
    expect([sample(0), sample(1), sample(2), sample(3), sample(4)]).toEqual([
      0, 16383, -16384, 32767, -32768,
    ]);
    // Beyond full scale is held at it, never wrapped.
    expect(sample(5)).toBe(32767);
  });
});
