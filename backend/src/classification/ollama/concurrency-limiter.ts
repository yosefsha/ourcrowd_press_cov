/**
 * Runs at most `limit` tasks at once; further tasks wait in arrival order.
 * Keeps the collector from sending Ollama more requests than it serves in
 * parallel (`OLLAMA_NUM_PARALLEL`), so waiting happens here rather than eating
 * into each request's timeout on the server's queue.
 */
export class ConcurrencyLimiter {
  private active = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(private readonly limit: number) {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new RangeError(`Concurrency limit must be a positive integer, got ${limit}`);
    }
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.limit) {
      this.active += 1;
      return Promise.resolve();
    }
    // The slot is handed over directly by `release`, so `active` stays counted.
    return new Promise((resolve) => this.waiting.push(resolve));
  }

  private release(): void {
    const next = this.waiting.shift();
    if (next) {
      next();
    } else {
      this.active -= 1;
    }
  }
}
