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

  /** Count `uses` uses of this key (one by default); the seconds to wait when that went over the limit, else 0. */
  hit(key: string, uses = 1): number {
    const now = this.clock();
    if (this.windows.size > 10_000) this.prune(now);
    const window = this.windows.get(key);
    if (!window || now - window.start >= this.windowMs) {
      this.windows.set(key, { start: now, count: uses });
      if (uses > this.limit) return Math.max(1, Math.ceil(this.windowMs / 1000));
    } else {
      window.count += uses;
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
