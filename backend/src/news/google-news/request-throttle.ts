/** Waits for the given number of milliseconds. */
export type Sleep = (ms: number) => Promise<void>;

const realSleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Spaces requests to one host at least `minIntervalMs` apart, across every
 * caller in the process, so a Backfill over many companies stays polite.
 */
export class RequestThrottle {
  private nextSlotAt = 0;

  constructor(
    private readonly minIntervalMs: number,
    private readonly now: () => number = Date.now,
    private readonly sleep: Sleep = realSleep,
  ) {
    if (!Number.isFinite(minIntervalMs) || minIntervalMs < 0) {
      throw new RangeError('minIntervalMs must be a non-negative number');
    }
  }

  /** Resolves when the caller may send its request. */
  async acquire(): Promise<void> {
    const now = this.now();
    const slot = Math.max(now, this.nextSlotAt);
    this.nextSlotAt = slot + this.minIntervalMs;
    if (slot > now) {
      await this.sleep(slot - now);
    }
  }
}
