import type { CSSProperties, ReactNode } from "react";
import { cn } from "../lib/cn";
import { WindowLight } from "./brand";

/** Where the room's light falls (sintr.css, `.sintr-room[data-scene]`). */
export type RoomScene =
  | "welcome"
  | "name"
  | "therapist"
  | "session"
  | "invite"
  | "ready"
  | "home"
  | "conversation"
  | "listening"
  | "reading";

/**
 * The room's light: the window, fixed behind the page, drifting to a new
 * place when the scene changes, in the colours of the person's time of day.
 * Decorative only, one per page; on reading pages it stays in the header.
 */
export function RoomLight({ scene, className }: { scene: RoomScene; className?: string }) {
  return (
    <div aria-hidden="true" data-scene={scene} className={cn("sintr-room", className)}>
      <div className="sintr-room__pane">
        <WindowLight className="inset-0" />
      </div>
    </div>
  );
}

/** What the pool of light is doing (sintr.css, `.sintr-pool[data-mood]`). */
export type PoolMood = "resting" | "listening" | "transcribing" | "thinking" | "proposing" | "paused";

/**
 * The pool of light: a small patch of the window light that breathes, and
 * shows what is happening without a word (the words are said beside it for
 * screen readers). `level` (0 to 1) follows the voice while it listens.
 */
export function LightPool({
  mood,
  size,
  className,
  levelRef,
}: {
  mood: PoolMood;
  /** In pixels; without it, 168px or whatever `--pool-size` the class sets. */
  size?: number;
  className?: string;
  /** Set to the element whose `--pool-level` follows the voice, frame by frame, without re-rendering. */
  levelRef?: (element: HTMLDivElement | null) => void;
}) {
  return (
    <div
      aria-hidden="true"
      data-mood={mood}
      className={cn("sintr-pool", className)}
      style={size ? ({ "--pool-size": `${size}px` } as CSSProperties) : undefined}
    >
      <div ref={levelRef} className="sintr-pool__body">
        <div className="sintr-pool__breath">
          <span className="sintr-pool__layer sintr-pool__layer--a" />
          <span className="sintr-pool__layer sintr-pool__layer--b" />
          <span className="sintr-pool__layer sintr-pool__layer--c" />
          <span className="sintr-pool__layer sintr-pool__layer--d" />
        </div>
      </div>
    </div>
  );
}

/** Children settle in one after another (fade up from a slight blur), unless motion is unwelcome. */
export function Rise({
  index = 0,
  as: Tag = "div",
  className,
  children,
}: {
  index?: number;
  as?: "div" | "p" | "h1" | "h2" | "section" | "li";
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag className={cn("sintr-rise", className)} style={{ "--i": index } as CSSProperties}>
      {children}
    </Tag>
  );
}
