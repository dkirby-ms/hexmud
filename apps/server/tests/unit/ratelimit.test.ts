import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HeartbeatRateLimiter } from '../../src/ratelimit/heartbeat.js';

const OPTIONS = {
  capacity: 2,
  refillAmount: 1,
  refillIntervalMs: 1_000
};

describe('HeartbeatRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows up to capacity heartbeats before rate limiting', () => {
    const limiter = new HeartbeatRateLimiter(OPTIONS);

    expect(limiter.consume('session-1')).toBe(true);
    expect(limiter.consume('session-1')).toBe(true);
    expect(limiter.consume('session-1')).toBe(false);
  });

  it('refills tokens after the configured interval', () => {
    const limiter = new HeartbeatRateLimiter(OPTIONS);

    limiter.consume('session-1');
    limiter.consume('session-1');
    expect(limiter.consume('session-1')).toBe(false);

    vi.advanceTimersByTime(1_000);

    expect(limiter.consume('session-1')).toBe(true);
  });

  it('tracks buckets per session independently and supports clearing', () => {
    const limiter = new HeartbeatRateLimiter(OPTIONS);

    expect(limiter.consume('session-a')).toBe(true);
    expect(limiter.consume('session-b')).toBe(true);
    expect(limiter.consume('session-a')).toBe(true);
    expect(limiter.consume('session-a')).toBe(false);

    limiter.clear('session-a');
    expect(limiter.consume('session-a')).toBe(true);

    limiter.clearAll();
    expect(limiter.consume('session-b')).toBe(true);
  });
});
