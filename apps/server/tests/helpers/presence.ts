import { randomUUID } from 'node:crypto';

export interface PresenceTestRecord {
  playerId: string;
  hexId: string;
  presenceValue: number;
  tierId: number;
  lastVisitedAt: Date;
  lastIncrementAt: Date;
}

export const createPresenceTestRecord = (
  overrides: Partial<PresenceTestRecord> = {}
): PresenceTestRecord => {
  const now = new Date();
  return {
    playerId: overrides.playerId ?? `player-${randomUUID()}`,
    hexId: overrides.hexId ?? 'hex:0:0',
    presenceValue: overrides.presenceValue ?? 1,
    tierId: overrides.tierId ?? 0,
    lastVisitedAt: overrides.lastVisitedAt ?? now,
    lastIncrementAt: overrides.lastIncrementAt ?? now
  };
};

export interface PresenceTestClock {
  now: () => number;
  advance: (milliseconds: number) => number;
  reset: () => void;
}

export const createPresenceTestClock = (initial = Date.now()): PresenceTestClock => {
  let current = initial;
  return {
    now: () => current,
    advance: (milliseconds: number) => {
      current += milliseconds;
      return current;
    },
    reset: () => {
      current = initial;
    }
  };
};
