"use client";

import { Button } from "@sintr/ui";
import { elapsed, type VoicePhase, type VoiceProblem } from "@/lib/voice/state";
import { useMessages } from "@/components/language";

function MicIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className="size-[18px] fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.6]"
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
    </svg>
  );
}

/** Speak instead of typing: the composer's button while the box is empty, where the thumb rests. */
export function VoiceButton({ onSpeak }: { onSpeak: () => void }) {
  const t = useMessages();
  return (
    <Button type="button" onClick={onSpeak} aria-label={t.voice.speakLabel} className="shrink-0 pl-5 pr-6">
      <MicIcon />
      {t.voice.speak}
    </Button>
  );
}

/**
 * While the person speaks: the time so far, and two ways out, Done (write
 * it down) and Cancel (keep nothing). Then, while it is written down, one
 * quiet line in its place.
 */
export function VoiceBar({
  phase,
  spokenMs,
  onDone,
  onCancel,
}: {
  phase: VoicePhase;
  spokenMs: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useMessages();
  if (phase === "transcribing") {
    return (
      <div className="flex min-h-[52px] items-center gap-3 rounded-[22px] border border-rule px-[18px]">
        <span aria-hidden="true" className="flex gap-1">
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className="size-1.5 rounded-full bg-ink-soft motion-safe:animate-pulse"
              style={{ animationDelay: `${dot * 180}ms` }}
            />
          ))}
        </span>
        <span className="text-[0.9688rem] text-ink-2">{t.voice.transcribing}</span>
      </div>
    );
  }
  return (
    <div
      role="group"
      aria-label={t.voice.listening}
      className="flex min-h-[52px] flex-wrap items-center gap-x-4 gap-y-2 rounded-[22px] border border-ink py-1.5 pl-[18px] pr-1.5"
    >
      <span className="flex items-center gap-2.5 text-[0.9688rem] text-ink">
        <span
          aria-hidden="true"
          className="size-[7px] rounded-full bg-draft shadow-[0_0_0_3px_#fbe6da] motion-safe:animate-pulse"
        />
        {phase === "asking" ? t.voice.speak : t.voice.listening}
        <span className="tabular-nums text-ink-3">{elapsed(spokenMs)}</span>
      </span>
      <span className="ml-auto flex items-center gap-4">
        <Button type="button" variant="quiet" size="inline" onClick={onCancel} className="text-[0.9375rem]">
          {t.voice.cancel}
        </Button>
        <Button type="button" onClick={onDone} disabled={phase !== "listening"} className="min-h-11">
          {t.voice.done}
        </Button>
      </span>
    </div>
  );
}

/** What happened to the last recording: a problem said plainly, or the words heard, to check before sending. */
export function VoiceNotes({
  problem,
  onDismiss,
  heard,
  onClear,
}: {
  problem: VoiceProblem | null;
  onDismiss: () => void;
  heard: boolean;
  onClear: () => void;
}) {
  const t = useMessages();
  if (problem) {
    return (
      <div
        role="alert"
        className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[0.9375rem] text-ink"
      >
        <p className="min-w-0 flex-1">{t.voice.problems[problem]}</p>
        <Button type="button" variant="quiet" size="inline" onClick={onDismiss} className="text-[0.875rem]">
          {t.voice.dismiss}
        </Button>
      </div>
    );
  }
  if (!heard) return null;
  return (
    <div role="status" className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[0.9375rem]">
      <p className="min-w-0 flex-1 font-serif italic text-ink-2">{t.voice.heard}</p>
      <Button type="button" variant="quiet" size="inline" onClick={onClear} className="text-[0.875rem]">
        {t.voice.clear}
      </Button>
    </div>
  );
}
