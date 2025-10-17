import { TokenBucket, type TokenBucketOptions } from './tokenBucket.js';

export interface HeartbeatRateLimiterOptions extends TokenBucketOptions {}

const invalidTokenAttempts = new Map<string, number>();

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
    invalidTokenAttempts.delete(sessionId);
  }

  clearAll(): void {
    this.buckets.clear();
    invalidTokenAttempts.clear();
  }
}

export const incrementInvalidTokenAttempt = (sessionId: string): number => {
  const previous = invalidTokenAttempts.get(sessionId) ?? 0;
  const next = previous + 1;
  invalidTokenAttempts.set(sessionId, next);
  return next;
};

export const getInvalidTokenAttempts = (sessionId: string): number => {
  return invalidTokenAttempts.get(sessionId) ?? 0;
};

export const clearInvalidTokenAttempts = (sessionId: string): void => {
  invalidTokenAttempts.delete(sessionId);
};
