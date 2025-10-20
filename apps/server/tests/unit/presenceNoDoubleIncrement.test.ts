import { describe, expect, it } from 'vitest';

import { canIncrementPresence } from '../../src/state/presenceEligibility.js';

const intervalMs = 10_000;
const dwellFraction = 0.9;

describe('presence increment guard', () => {
  it('allows first increment when no prior record exists', () => {
    const now = new Date('2025-01-01T00:00:10Z');
    const dwellTime = intervalMs;

    const eligible = canIncrementPresence({
      lastIncrementAt: null,
      now,
      dwellTimeMs: dwellTime,
      intervalMs,
      requiredDwellFraction: dwellFraction
    });

    expect(eligible).toBe(true);
  });

  it('rejects second increment within the same interval', () => {
    const lastIncrement = new Date('2025-01-01T00:00:10Z');
    const now = new Date('2025-01-01T00:00:15Z');
    const dwellTime = intervalMs;

    const eligible = canIncrementPresence({
      lastIncrementAt: lastIncrement,
      now,
      dwellTimeMs: dwellTime,
      intervalMs,
      requiredDwellFraction: dwellFraction
    });

    expect(eligible).toBe(false);
  });
});
