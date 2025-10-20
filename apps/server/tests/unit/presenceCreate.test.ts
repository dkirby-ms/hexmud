import { beforeEach, describe, expect, it } from 'vitest';

import { createInitialPresenceRecord } from '../../src/state/presenceLifecycle.js';
import { resetPresenceTierConfig } from '../../src/state/presenceTiers.js';

describe('createInitialPresenceRecord', () => {
  beforeEach(() => {
    resetPresenceTierConfig();
  });

  it('initialises a presence record with baseline values and timestamps', () => {
    const now = new Date('2025-01-01T00:00:00Z');

    const record = createInitialPresenceRecord({
      playerId: 'player-1',
      hexId: 'hex:10:5',
      now
    });

    expect(record.playerId).toBe('player-1');
    expect(record.hexId).toBe('hex:10:5');
    expect(record.presenceValue).toBeGreaterThan(0);
    expect(record.presenceValue).toBe(1);
    expect(record.tierId).toBe(0);
    expect(record.createdAt).toEqual(now);
    expect(record.updatedAt).toEqual(now);
    expect(record.lastVisitedAt).toEqual(now);
    expect(record.lastIncrementAt).toEqual(now);
    expect(record.decayState).toBe('active');
  });
});
