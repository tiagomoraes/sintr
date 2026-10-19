"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { IDLE, voiceReducer, type VoiceProblem } from "./state";
import { toSpeechWav } from "./wav";

/** At most five minutes a recording, as the server takes it. */
export const MAX_RECORDING_SECONDS = 300;
/** Under this, nothing is sent: a tap, not a sentence. */
const MIN_RECORDING_MS = 800;

/** Containers in order of preference: Opus where the browser records it, AAC on Safari and iOS. */
const CONTAINERS = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/aac",
];

/** Whether this browser can record at all; without it, the home is text only. */
export function canRecord(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.MediaRecorder !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}

function container(): string | undefined {
  if (typeof MediaRecorder.isTypeSupported !== "function") return undefined;
  return CONTAINERS.find((type) => MediaRecorder.isTypeSupported(type));
}

/** What the server heard: the words, and whether the screen for risk saw something in them. */
export interface Heard {
  text: string;
  risk: boolean;
}

interface Session {
  stream: MediaStream;
  recorder: MediaRecorder;
  chunks: Blob[];
  audio: AudioContext | null;
  frame: number | null;
  limit: ReturnType<typeof setTimeout> | null;
  startedAt: number;
  cancelled: boolean;
}

function problemOf(error: unknown): "denied" | "no_microphone" | "failed" {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "no_microphone";
  return "failed";
}

/**
 * Speaking, in the browser: open the microphone on the person's tap,
 * record (WebM where the browser can, MP4 on Safari and iOS), follow the
 * voice's level for the pool of light, and on Done send the recording to
 * be written down. Nothing is kept on the device; the words come back to
 * `onHeard`, for the person to read before anything is sent.
 */
export function useVoice({
  wav,
  secondsLeft,
  conversationId,
  onHeard,
}: {
  /** Send WAV (for a provider that cannot read WebM or MP4). */
  wav: boolean;
  /** Seconds of speaking left this month, or null for no limit: recording stops there. */
  secondsLeft: number | null;
  conversationId: () => string | null;
  onHeard: (heard: Heard) => void;
}) {
  const [state, dispatch] = useReducer(voiceReducer, IDLE);
  const [now, setNow] = useState(0);
  // Once the month's speaking time is used, the Speak button goes until the page is opened again.
  const [spent, setSpent] = useState(false);
  const session = useRef<Session | null>(null);
  const levelTargets = useRef(new Set<HTMLElement>());
  const heard = useRef(onHeard);
  useEffect(() => {
    heard.current = onHeard;
  }, [onHeard]);

  const setLevel = (level: number) => {
    for (const element of levelTargets.current) element.style.setProperty("--pool-level", level.toFixed(3));
  };

  const release = useCallback((current: Session) => {
    if (current.frame !== null) cancelAnimationFrame(current.frame);
    if (current.limit !== null) clearTimeout(current.limit);
    for (const track of current.stream.getTracks()) track.stop();
    void current.audio?.close().catch(() => undefined);
    setLevel(0);
  }, []);

  const send = useCallback(
    async (recording: Blob, durationMs: number) => {
      try {
        const body = wav ? await toSpeechWav(recording) : recording;
        const params = new URLSearchParams({ seconds: (durationMs / 1000).toFixed(1) });
        const id = conversationId();
        if (id) params.set("conversation", id);
        const response = await fetch(`/api/voice?${params.toString()}`, {
          method: "POST",
          headers: { "content-type": body.type || "audio/webm" },
          body,
        });
        if (response.status === 429) {
          setSpent(true);
          return dispatch({ type: "failed", problem: "limit" });
        }
        if (!response.ok) return dispatch({ type: "failed", problem: "failed" });
        const result = (await response.json()) as { text?: unknown; risk?: unknown };
        const text = typeof result.text === "string" ? result.text : "";
        dispatch({ type: "heard", text });
        if (text.trim()) heard.current({ text, risk: result.risk === true });
      } catch {
        dispatch({ type: "failed", problem: "failed" });
      }
    },
    [wav, conversationId],
  );

  const stop = useCallback(() => {
    const current = session.current;
    if (!current || current.recorder.state === "inactive") return;
    dispatch({ type: "stop" });
    current.recorder.stop();
  }, []);

  const start = useCallback(async () => {
    if (session.current) return;
    dispatch({ type: "ask" });
    // Made inside the tap, so iOS lets it run; it only measures the level.
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let audio: AudioContext | null = null;
    try {
      audio = reduce ? null : new AudioContext();
    } catch {
      audio = null;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
    } catch (error) {
      void audio?.close().catch(() => undefined);
      dispatch({ type: "refused", problem: problemOf(error) });
      return;
    }
    let recorder: MediaRecorder;
    try {
      const type = container();
      recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    } catch {
      for (const track of stream.getTracks()) track.stop();
      void audio?.close().catch(() => undefined);
      dispatch({ type: "refused", problem: "failed" });
      return;
    }
    const current: Session = {
      stream,
      recorder,
      chunks: [],
      audio,
      frame: null,
      limit: null,
      startedAt: Date.now(),
      cancelled: false,
    };
    session.current = current;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) current.chunks.push(event.data);
    };
    recorder.onstop = () => {
      const duration = Date.now() - current.startedAt;
      release(current);
      session.current = null;
      if (current.cancelled) return;
      if (duration < MIN_RECORDING_MS) return dispatch({ type: "failed", problem: "too_short" });
      const type = recorder.mimeType || current.chunks[0]?.type || "audio/webm";
      void send(new Blob(current.chunks, { type }), duration);
    };
    // The pool follows the voice: the loudness of the last frame, smoothed, without re-rendering.
    if (audio) {
      try {
        await audio.resume();
        const analyser = audio.createAnalyser();
        analyser.fftSize = 512;
        audio.createMediaStreamSource(stream).connect(analyser);
        const samples = new Float32Array(analyser.fftSize);
        let smooth = 0;
        const tick = () => {
          analyser.getFloatTimeDomainData(samples);
          let sum = 0;
          for (const sample of samples) sum += sample * sample;
          const level = Math.min(1, Math.sqrt(sum / samples.length) * 5);
          smooth = smooth * 0.7 + level * 0.3;
          setLevel(smooth);
          current.frame = requestAnimationFrame(tick);
        };
        current.frame = requestAnimationFrame(tick);
      } catch {
        // The level is only a reflection; recording goes on without it.
      }
    }
    recorder.start();
    const allowed = Math.min(MAX_RECORDING_SECONDS, secondsLeft ?? MAX_RECORDING_SECONDS);
    current.limit = setTimeout(stop, Math.max(1, allowed) * 1000);
    dispatch({ type: "granted", at: current.startedAt });
  }, [release, send, secondsLeft, stop]);

  const cancel = useCallback(() => {
    const current = session.current;
    dispatch({ type: "cancel" });
    if (!current) return;
    current.cancelled = true;
    if (current.recorder.state !== "inactive") current.recorder.stop();
    else {
      release(current);
      session.current = null;
    }
  }, [release]);

  // The time spoken, twice a second while listening.
  useEffect(() => {
    if (state.phase !== "listening") return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [state.phase]);

  // Leaving the page closes the microphone and keeps nothing.
  useEffect(
    () => () => {
      const current = session.current;
      if (!current) return;
      current.cancelled = true;
      if (current.recorder.state !== "inactive") current.recorder.stop();
      release(current);
    },
    [release],
  );

  /** A pool of light that follows the voice; give it as `levelRef`. */
  const levelRef = useCallback((element: HTMLElement | null) => {
    if (element) levelTargets.current.add(element);
    else levelTargets.current.forEach((target) => !target.isConnected && levelTargets.current.delete(target));
  }, []);

  const spokenMs = state.phase === "listening" && state.startedAt ? Math.max(0, now - state.startedAt) : 0;

  return {
    state,
    spent,
    spokenMs,
    start: () => void start(),
    stop,
    cancel,
    dismiss: () => dispatch({ type: "dismiss" }),
    levelRef,
  };
}

export type { VoiceProblem };
