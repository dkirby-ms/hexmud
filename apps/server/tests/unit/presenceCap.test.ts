import { beforeEach, describe, expect, it } from 'vitest';

import {
  applyPresenceIncrement,
  createInitialPresenceRecord
} from '../../src/state/presenceLifecycle.js';
import { resetPresenceTierConfig } from '../../src/state/presenceTiers.js';

describe('presence cap logic', () => {
  beforeEach(() => {
    resetPresenceTierConfig();
  });

  it('caps presence at configured maximum and flags cap reason', () => {
    const now = new Date('2025-01-01T00:00:00Z');
    const record = createInitialPresenceRecord({
      playerId: 'player-1',
      hexId: 'hex:1:1',
      now
    });

    const nearCap = applyPresenceIncrement({
      record,
      increment: 99,
      now: new Date('2025-01-01T00:00:10Z')
    });

    expect(nearCap.updated.presenceValue).toBe(100);
    expect(nearCap.updated.tierId).toBeGreaterThanOrEqual(0);
    expect(nearCap.delta).toBe(99);
    expect(nearCap.reason).toBe('cap');
    expect(nearCap.capped).toBe(true);
  });

  it('prevents further increments once cap reached', () => {
    const now = new Date('2025-01-01T00:00:00Z');
    const record = createInitialPresenceRecord({
      playerId: 'player-1',
      hexId: 'hex:1:1',
      now
    });

    const capped = applyPresenceIncrement({
      record,
      increment: 99,
      now: new Date('2025-01-01T00:00:10Z')
    });

    const attempt = applyPresenceIncrement({
      record: capped.updated,
      increment: 5,
      now: new Date('2025-01-01T00:00:20Z')
    });

    expect(attempt.updated.presenceValue).toBe(100);
    expect(attempt.delta).toBe(0);
    expect(attempt.reason).toBe('capped');
    expect(attempt.capped).toBe(true);
  });
});
