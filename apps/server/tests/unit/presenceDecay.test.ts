import { beforeEach, describe, expect, it } from 'vitest';

import { env } from '../../src/config/env.js';
import { applyPresenceDecay } from '../../src/state/presenceLifecycle.js';
import type { PlayerPresenceRecord } from '../../src/state/presenceTypes.js';
import { getPresenceTierConfig, resetPresenceTierConfig } from '../../src/state/presenceTiers.js';

const clonePresenceConfig = () => ({
  cap: env.presence.cap,
  floorPercent: env.presence.floorPercent,
  decayPercent: env.presence.decayPercent,
  inactivityMs: env.presence.inactivityMs,
  intervalMs: env.presence.intervalMs,
  dwellFraction: env.presence.dwellFraction
});

const restorePresenceConfig = (snapshot: ReturnType<typeof clonePresenceConfig>) => {
  env.presence.cap = snapshot.cap;
  env.presence.floorPercent = snapshot.floorPercent;
  env.presence.decayPercent = snapshot.decayPercent;
  env.presence.inactivityMs = snapshot.inactivityMs;
  env.presence.intervalMs = snapshot.intervalMs;
  env.presence.dwellFraction = snapshot.dwellFraction;
  resetPresenceTierConfig();
  getPresenceTierConfig();
};

describe('presence decay lifecycle', () => {
  const originalPresenceConfig = clonePresenceConfig();

  beforeEach(() => {
    restorePresenceConfig(originalPresenceConfig);
  });

  const createRecord = (presenceValue: number): PlayerPresenceRecord => {
    const now = new Date('2025-01-01T00:00:00Z');
    return {
      playerId: 'player-1',
      hexId: 'hex:0:0',
      presenceValue,
      tierId: 0,
      createdAt: now,
      updatedAt: now,
      lastVisitedAt: now,
      lastIncrementAt: now,
      decayState: 'active'
    };
  };

  it('applies decay percentage and marks record as decaying', () => {
    env.presence.decayPercent = 0.05;
    resetPresenceTierConfig();
    const record = createRecord(100);
    const now = new Date('2025-01-02T00:00:00Z');

    const result = applyPresenceDecay({
      record,
      now
    });

    expect(result.delta).toBe(-5);
    expect(result.updated.presenceValue).toBe(95);
    expect(result.updated.decayState).toBe('decaying');
    expect(result.updated.updatedAt).toEqual(now);
    expect(result.updated.lastVisitedAt).toEqual(record.lastVisitedAt);
  });

  it('clamps decay at floor value and avoids negative drift', () => {
    env.presence.decayPercent = 0.25;
    env.presence.cap = 40;
    env.presence.floorPercent = 0.2;
    resetPresenceTierConfig();
    const config = getPresenceTierConfig();
    const record = createRecord(config.floorValue + 1);
    const now = new Date('2025-01-02T00:00:00Z');

    const result = applyPresenceDecay({
      record,
      now
    });

    expect(result.delta).toBe(-1);
    expect(result.updated.presenceValue).toBe(config.floorValue);
    expect(result.updated.decayState).toBe('decaying');

    const second = applyPresenceDecay({
      record: result.updated,
      now: new Date('2025-01-03T00:00:00Z')
    });

    expect(second.delta).toBe(0);
    expect(second.updated.presenceValue).toBe(config.floorValue);
  });
});
