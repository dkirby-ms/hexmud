import { describe, expect, it } from 'vitest';

import { canIncrementPresence } from '../../src/state/presenceEligibility.js';

describe('presence dwell fraction calculation', () => {
  const intervalMs = 10_000;
  const dwellFraction = 0.9;

  it('requires minimum dwell fraction before allowing increment', () => {
    const now = new Date('2025-01-01T00:00:10Z');
    const lastIncrementAt = new Date('2025-01-01T00:00:00Z');

    const eligible = canIncrementPresence({
      lastIncrementAt,
      now,
      dwellTimeMs: Math.floor(intervalMs * 0.5),
      intervalMs,
      requiredDwellFraction: dwellFraction
    });

    expect(eligible).toBe(false);
  });

  it('permits increment when dwell fraction and interval requirements are satisfied', () => {
    const now = new Date('2025-01-01T00:00:15Z');
    const lastIncrementAt = new Date('2025-01-01T00:00:00Z');

    const eligible = canIncrementPresence({
      lastIncrementAt,
      now,
      dwellTimeMs: Math.ceil(intervalMs * dwellFraction),
      intervalMs,
      requiredDwellFraction: dwellFraction
    });

    expect(eligible).toBe(true);
  });
});
