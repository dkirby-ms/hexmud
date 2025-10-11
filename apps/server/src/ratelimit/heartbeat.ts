import { TokenBucket, type TokenBucketOptions } from './tokenBucket.js';

export interface HeartbeatRateLimiterOptions extends TokenBucketOptions {}

export class HeartbeatRateLimiter {
  private readonly buckets = new Map<string, TokenBucket>();

  constructor(private readonly options: HeartbeatRateLimiterOptions) {}

  consume(sessionId: string): boolean {
    let bucket = this.buckets.get(sessionId);
    if (!bucket) {
      bucket = new TokenBucket(this.options);
      this.buckets.set(sessionId, bucket);
    }
    return bucket.tryRemove();
  }

  clear(sessionId: string): void {
    this.buckets.delete(sessionId);
  }

  clearAll(): void {
    this.buckets.clear();
  }
}
