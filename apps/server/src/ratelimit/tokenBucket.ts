export interface TokenBucketOptions {
  capacity: number;
  refillAmount: number;
  refillIntervalMs: number;
}

export class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(private readonly options: TokenBucketOptions) {
    if (options.capacity <= 0) {
      throw new Error('Token bucket capacity must be > 0');
    }
    this.tokens = options.capacity;
    this.lastRefill = Date.now();
  }

  private refill(now: number): void {
    const elapsed = now - this.lastRefill;
    if (elapsed < this.options.refillIntervalMs) {
      return;
    }

    const intervals = Math.floor(elapsed / this.options.refillIntervalMs);
    if (intervals <= 0) {
      return;
    }

    this.tokens = Math.min(
      this.options.capacity,
      this.tokens + intervals * this.options.refillAmount
    );
    this.lastRefill += intervals * this.options.refillIntervalMs;
  }

  tryRemove(tokens = 1): boolean {
    if (tokens <= 0) {
      return true;
    }

    const now = Date.now();
    this.refill(now);

    if (this.tokens < tokens) {
      return false;
    }

    this.tokens -= tokens;
    return true;
  }

  get availableTokens(): number {
    this.refill(Date.now());
    return this.tokens;
  }
}
