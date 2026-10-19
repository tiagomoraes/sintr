"use client";

import { LightPool, cn, type PoolMood } from "@sintr/ui";
import {
  Component,
  createContext,
  use,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { inView, placement, sameBox, travelTime, type Box } from "@/lib/assistant/flight";

/**
 * The pool of light travels. It rests in one place at a time (a "dock": the
 * middle of the home, beside the box once a conversation begins, the corner
 * of a page, the conversation opened beside a page), and when it leaves one
 * place for another it is carried across the screen as one square, moved
 * and scaled about its centre, with the Web Animations API: transform only,
 * on the compositor, and nothing in its way (the travelling pool takes no
 * pointer). Its own movements (the breath, the layers turning) are handed
 * over by their clock, so the pool that lands is the pool that left. With
 * reduced motion it is simply in each place, without travelling.
 */

/** Across on the light's slow in-out; down a little later; so the way bows gently, as a thing carried would. */
const EASE_ACROSS = "cubic-bezier(0.45, 0.05, 0.2, 1)";
const EASE_DOWN = "cubic-bezier(0.62, 0.02, 0.24, 1)";
const EASE_SIZE = "cubic-bezier(0.4, 0, 0.2, 1)";
/** How long a pool that rose from one place waits for the next to appear (a page still arriving). */
const WAIT_MS = 700;
/** The last stretch, when the place moved while the pool was on its way (the page settled under it). */
const SETTLE_MS = 320;

interface Departure {
  box: Box;
  clock: Map<string, number>;
  at: number;
}

interface Landing {
  pool: HTMLElement;
  to: Box;
  land: () => void;
}

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function boxOf(element: Element): Box {
  const { x, y, width, height } = element.getBoundingClientRect();
  return { x, y, width, height };
}

/**
 * Where an element will be once the entrances around it have played (a
 * sheet sliding up, a panel coming in): each finite animation of an
 * ancestor is run to its end for the measure and put back, within the same
 * frame, so nothing of it is ever drawn.
 */
function settledBox(element: Element): Box {
  const moving = document.getAnimations().filter((animation) => {
    const target = animation.effect instanceof KeyframeEffect ? animation.effect.target : null;
    const end = animation.effect?.getComputedTiming().endTime;
    return (
      target !== null &&
      target !== element &&
      target.contains(element) &&
      animation.playState === "running" &&
      typeof end === "number" &&
      Number.isFinite(end)
    );
  });
  const times = moving.map((animation) => animation.currentTime);
  for (const animation of moving) {
    const end = animation.effect?.getComputedTiming().endTime;
    if (typeof end === "number") animation.currentTime = end;
  }
  const box = boxOf(element);
  moving.forEach((animation, index) => {
    animation.currentTime = times[index] ?? null;
  });
  return box;
}

function viewport() {
  return { width: window.innerWidth, height: window.innerHeight };
}

/** A pool's movement by the element it moves and what it is ("sintr-pool__breath|sintr-pool-breathe"). */
function keyOf(animation: Animation): string | null {
  if (typeof CSSAnimation === "undefined" || !(animation instanceof CSSAnimation)) return null;
  const target = animation.effect instanceof KeyframeEffect ? animation.effect.target : null;
  return target ? `${target.className}|${animation.animationName}` : null;
}

/** Where each of a pool's own movements is, in milliseconds. */
function clockOf(pool: Element): Map<string, number> {
  const clock = new Map<string, number>();
  for (const animation of pool.getAnimations({ subtree: true })) {
    const key = keyOf(animation);
    if (key && typeof animation.currentTime === "number") clock.set(key, animation.currentTime);
  }
  return clock;
}

/** Set a pool's movements where another's were, `later` milliseconds on. */
function setClock(pool: Element, clock: Map<string, number>, later: number) {
  for (const animation of pool.getAnimations({ subtree: true })) {
    const key = keyOf(animation);
    const time = key ? clock.get(key) : undefined;
    if (time !== undefined) animation.currentTime = time + later;
  }
}

/** The travelling pool and its journeys. One per shell; the docks call `leave` and `arrive`. */
class Journeys {
  #layer: HTMLDivElement | null = null;
  #across: HTMLDivElement | null = null;
  #down: HTMLDivElement | null = null;
  #grow: HTMLDivElement | null = null;
  #departure: Departure | null = null;
  #landing: Landing | null = null;
  /** The pool resting now, and where it was just before the page last changed. */
  #resting: HTMLElement | null = null;
  #remembered: (Departure & { pool: HTMLElement }) | null = null;
  #moving: Animation[] = [];
  #waiting: ReturnType<typeof setTimeout> | null = null;

  /** The travelling layer, and the three parts inside it that move it across, down, and in size. */
  attach(layer: HTMLDivElement | null) {
    const part = (name: string) => layer?.querySelector<HTMLDivElement>(`[data-part="${name}"]`) ?? null;
    this.#layer = layer;
    this.#across = part("across");
    this.#down = part("down");
    this.#grow = part("grow");
  }

  get #pool(): HTMLElement | null {
    return this.#layer?.querySelector<HTMLElement>(".sintr-pool") ?? null;
  }

  get #flying(): boolean {
    return this.#layer !== null && !this.#layer.hidden;
  }

  /**
   * Just before the page changes (React's snapshot before an update): where
   * the resting pool is. When its place goes in the same change, the things
   * around it may already be gone by the time it is told, and the page may
   * have moved under it; this is where the person last saw it.
   */
  remember() {
    const pool = this.#resting;
    if (!pool?.isConnected || this.#flying || reducedMotion()) return;
    this.#remembered = { pool, box: boxOf(pool), clock: clockOf(pool), at: performance.now() };
  }

  /** A place the pool rested is going: it rises from there and waits a moment for the next. */
  leave(pool: HTMLElement) {
    const remembered = this.#remembered?.pool === pool ? this.#remembered : null;
    this.#remembered = null;
    if (this.#resting === pool) this.#resting = null;
    const flying = this.#flying ? this.#pool : null;
    const from = flying ?? pool;
    if (!from.isConnected || reducedMotion()) return this.#rest();
    const box = !flying && remembered ? remembered.box : boxOf(from);
    const clock = !flying && remembered ? remembered.clock : clockOf(from);
    this.#stop();
    this.#landing = null;
    if (!inView(box, viewport())) {
      this.#departure = null;
      return this.#rest();
    }
    this.#departure = { box, clock, at: performance.now() };
    this.#show(box, box.width);
    const travelling = this.#pool;
    if (travelling) setClock(travelling, clock, 0);
    this.#waiting = setTimeout(() => this.#fade(), WAIT_MS);
  }

  /**
   * A place for the pool appeared. If the pool just left another, it travels
   * here and `land` shows this place's own pool once it is there; otherwise
   * it is here already. The returned function forgets a journey whose place
   * went before the pool reached it.
   */
  arrive(pool: HTMLElement, land: () => void): () => void {
    const departure = this.#departure;
    this.#departure = null;
    if (this.#waiting !== null) clearTimeout(this.#waiting);
    this.#waiting = null;
    const settle = () => {
      // A place that is not on screen (the other corner, at this width) holds nothing to remember.
      if (pool.getBoundingClientRect().width > 0) this.#resting = pool;
      land();
    };
    if (!departure || reducedMotion() || performance.now() - departure.at > WAIT_MS) {
      this.#rest();
      settle();
      return () => undefined;
    }
    let gone = false;
    // One frame on: the new page has its scroll and its layout, so the place is where it will stay.
    const frame = requestAnimationFrame(() => {
      if (!gone) this.#travel(departure.box, { pool, to: settledBox(pool), land: settle });
    });
    return () => {
      gone = true;
      cancelAnimationFrame(frame);
      if (this.#landing?.pool === pool) this.#landing = null;
    };
  }

  #travel(from: Box, landing: Landing, duration?: number) {
    const view = viewport();
    // Nothing flies to a place out of sight: the pool is simply there when the person scrolls to it.
    if (!inView(landing.to, view)) {
      this.#rest();
      return landing.land();
    }
    const size = Math.max(from.width, landing.to.width);
    this.#stop();
    this.#show(from, size);
    const across = this.#across;
    const down = this.#down;
    const grow = this.#grow;
    if (!across || !down || !grow) {
      this.#rest();
      return landing.land();
    }
    const a = placement(from, size);
    const b = placement(landing.to, size);
    const timing = {
      duration: duration ?? travelTime(from, landing.to, Math.hypot(view.width, view.height)),
      fill: "forwards" as const,
    };
    this.#landing = landing;
    this.#moving = [
      across.animate([{ transform: `translateX(${a.x}px)` }, { transform: `translateX(${b.x}px)` }], {
        ...timing,
        easing: EASE_ACROSS,
      }),
      down.animate([{ transform: `translateY(${a.y}px)` }, { transform: `translateY(${b.y}px)` }], {
        ...timing,
        easing: EASE_DOWN,
      }),
      grow.animate([{ transform: `scale(${a.scale})` }, { transform: `scale(${b.scale})` }], {
        ...timing,
        easing: EASE_SIZE,
      }),
    ];
    this.#moving[0]!.finished.then(
      () => this.#land(landing),
      () => undefined,
    );
  }

  /** There: the place's own pool takes over, at the travelling pool's moment. */
  #land(landing: Landing) {
    if (this.#landing !== landing) return;
    if (!landing.pool.isConnected) return this.#rest();
    const now = boxOf(landing.pool);
    if (!sameBox(now, landing.to) && inView(now, viewport())) {
      return this.#travel(landing.to, { ...landing, to: now }, SETTLE_MS);
    }
    const travelling = this.#pool;
    if (travelling) setClock(landing.pool, clockOf(travelling), 0);
    landing.land();
    this.#rest();
  }

  /** The travelling pool, shown over `box` as a square of `size`. */
  #show(box: Box, size: number) {
    const layer = this.#layer;
    const pool = this.#pool;
    if (!layer || !pool || !this.#across || !this.#down || !this.#grow) return;
    layer.style.width = `${size}px`;
    layer.style.height = `${size}px`;
    layer.style.opacity = "";
    pool.style.setProperty("--pool-size", `${size}px`);
    const at = placement(box, size);
    this.#across.style.transform = `translateX(${at.x}px)`;
    this.#down.style.transform = `translateY(${at.y}px)`;
    this.#grow.style.transform = `scale(${at.scale})`;
    layer.hidden = false;
  }

  /** Nowhere to go: the risen pool fades where it is. */
  #fade() {
    this.#waiting = null;
    const layer = this.#layer;
    if (!layer || layer.hidden) return;
    const fading = layer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 420, fill: "forwards" });
    this.#moving.push(fading);
    fading.finished.then(
      () => this.#rest(),
      () => undefined,
    );
  }

  #stop() {
    for (const animation of this.#moving) animation.cancel();
    this.#moving = [];
    if (this.#waiting !== null) clearTimeout(this.#waiting);
    this.#waiting = null;
  }

  #rest() {
    this.#stop();
    this.#landing = null;
    if (this.#layer) this.#layer.hidden = true;
  }
}

interface Pools {
  journeys: Journeys | null;
  mood: PoolMood;
  levelRef?: (element: HTMLDivElement | null) => void;
}

const PoolsContext = createContext<Pools>({ journeys: null, mood: "resting" });

/** Tells the journeys where the pool is just before each change of the page. */
class BeforeChange extends Component<{ journeys: Journeys; children: ReactNode }> {
  override getSnapshotBeforeUpdate() {
    this.props.journeys.remember();
    return null;
  }
  override componentDidUpdate() {}
  override render() {
    return this.props.children;
  }
}

/**
 * The travelling pool, above the page and below nothing that matters: it
 * takes no pointer and is hidden whenever it is not on its way.
 */
export function PoolStage({
  mood,
  levelRef,
  children,
}: {
  mood: PoolMood;
  levelRef: (element: HTMLDivElement | null) => void;
  children: ReactNode;
}) {
  const [journeys] = useState(() => new Journeys());
  const attach = useCallback((layer: HTMLDivElement | null) => journeys.attach(layer), [journeys]);
  return (
    <PoolsContext value={{ journeys, mood, levelRef }}>
      <BeforeChange journeys={journeys}>{children}</BeforeChange>
      <div ref={attach} hidden aria-hidden="true" className="sintr-flight">
        <div data-part="across" className="sintr-flight__part">
          <div data-part="down" className="sintr-flight__part">
            <div data-part="grow" className="sintr-flight__part sintr-flight__grow">
              <LightPool mood={mood} levelRef={levelRef} />
            </div>
          </div>
        </div>
      </div>
    </PoolsContext>
  );
}

/**
 * A place where the pool rests, a square of its size. Only one is on screen
 * at a time; when one goes and another comes, the pool travels between them.
 */
export function PoolDock({
  size,
  className,
  poolClassName,
}: {
  /** In pixels; or leave it out and give `--pool-size` in `poolClassName`, to change it with the screen. */
  size?: number;
  className?: string;
  poolClassName?: string;
}) {
  const { journeys, mood, levelRef } = use(PoolsContext);
  const holder = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const pool = holder.current?.querySelector<HTMLElement>(".sintr-pool");
    if (!journeys || !pool) return;
    pool.style.visibility = "hidden";
    const forget = journeys.arrive(pool, () => {
      pool.style.visibility = "";
    });
    return () => {
      forget();
      journeys.leave(pool);
    };
  }, [journeys]);
  return (
    <div ref={holder} aria-hidden="true" className={cn("flex-none", className)}>
      <LightPool mood={mood} levelRef={levelRef} size={size} className={poolClassName} />
    </div>
  );
}
