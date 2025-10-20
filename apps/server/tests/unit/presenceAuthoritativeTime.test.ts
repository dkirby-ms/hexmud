import { describe, expect, it } from 'vitest';

import { canIncrementPresence } from '../../src/state/presenceEligibility.js';

const intervalMs = 10_000;
const dwellFraction = 0.9;

describe('presence increment authoritative timing', () => {
  it('rejects increments when server interval has not elapsed despite client dwell claims', () => {
    const serverLastIncrement = new Date('2025-01-01T00:00:00Z');
    const serverNow = new Date('2025-01-01T00:00:05Z');
    const clientReportedDwell = intervalMs; // client may over-report dwell

    const eligible = canIncrementPresence({
      lastIncrementAt: serverLastIncrement,
      now: serverNow,
      dwellTimeMs: clientReportedDwell,
      intervalMs,
      requiredDwellFraction: dwellFraction
    });

    expect(eligible).toBe(false);
  });
});
