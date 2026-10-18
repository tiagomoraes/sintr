/**
 * A fixed-window counter per key, in memory. It bounds how often one token
 * may call, and how often one address may present a wrong token. Per
 * process: a second web process keeps its own counts, which only makes the
 * bound looser, never wrong.
 */
export class RateLimiter {
  private readonly windows = new Map<string, { start: number; count: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly clock: () => number = Date.now,
  ) {}

  /** Seconds to wait before this key may go on; 0 when it may go on now. */
  waitFor(key: string): number {
    const window = this.windows.get(key);
    const now = this.clock();
    if (!window || now - window.start >= this.windowMs || window.count < this.limit) return 0;
    return Math.max(1, Math.ceil((window.start + this.windowMs - now) / 1000));
  }

  /** Count one use of this key; returns what `waitFor` returns after it. */
  hit(key: string): number {
    const now = this.clock();
    if (this.windows.size > 10_000) this.prune(now);
    const window = this.windows.get(key);
    if (!window || now - window.start >= this.windowMs) {
      this.windows.set(key, { start: now, count: 1 });
    } else {
      window.count += 1;
      if (window.count > this.limit)
        return Math.max(1, Math.ceil((window.start + this.windowMs - now) / 1000));
    }
    return 0;
  }

  private prune(now: number): void {
    for (const [key, window] of this.windows) {
      if (now - window.start >= this.windowMs) this.windows.delete(key);
    }
  }
}
