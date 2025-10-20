import { getPresenceTierConfig, getPresenceTierIdForValue } from './presenceTiers.js';
import type { PlayerPresenceRecord, PresenceDecayState } from './presenceTypes.js';

export interface CreatePresenceRecordInput {
  playerId: string;
  hexId: string;
  now?: Date;
}

export interface PresenceIncrementInput {
  record: PlayerPresenceRecord;
  increment: number;
  now: Date;
}

export type PresenceIncrementReason = 'increment' | 'cap' | 'capped';

export interface PresenceIncrementResult {
  updated: PlayerPresenceRecord;
  delta: number;
  reason: PresenceIncrementReason;
  capped: boolean;
}

export interface PresenceDecayInput {
  record: PlayerPresenceRecord;
  now: Date;
}

export interface PresenceDecayResult {
  updated: PlayerPresenceRecord;
  delta: number;
  reachedFloor: boolean;
}

const resolveDecayState = (value: number, cap: number): PresenceDecayState => {
  if (value >= cap) {
    return 'capped';
  }
  return 'active';
};

export const createInitialPresenceRecord = ({
  playerId,
  hexId,
  now = new Date()
}: CreatePresenceRecordInput): PlayerPresenceRecord => {
  const config = getPresenceTierConfig();
  const presenceValue = 1;
  const tierId = getPresenceTierIdForValue(presenceValue);
  const timestamp = now;

  return {
    playerId,
    hexId,
    presenceValue,
    tierId,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastVisitedAt: timestamp,
    lastIncrementAt: timestamp,
    decayState: resolveDecayState(presenceValue, config.cap)
  };
};

export const applyPresenceIncrement = ({
  record,
  increment,
  now
}: PresenceIncrementInput): PresenceIncrementResult => {
  const config = getPresenceTierConfig();
  const nextValue = Math.min(config.cap, record.presenceValue + Math.max(0, increment));
  const delta = nextValue - record.presenceValue;
  const capped = nextValue >= config.cap;
  const reason: PresenceIncrementReason = capped
    ? delta === 0
      ? 'capped'
      : 'cap'
    : 'increment';
  const updatedTier = getPresenceTierIdForValue(nextValue);
  const decayState = resolveDecayState(nextValue, config.cap);

  const updated: PlayerPresenceRecord = {
    ...record,
    presenceValue: nextValue,
    tierId: updatedTier,
    updatedAt: now,
    lastVisitedAt: now,
    lastIncrementAt: delta > 0 ? now : record.lastIncrementAt,
    decayState
  };

  return {
    updated,
    delta,
    reason,
    capped
  };
};

export const applyPresenceDecay = ({ record, now }: PresenceDecayInput): PresenceDecayResult => {
  const config = getPresenceTierConfig();
  const rawDecrease = record.presenceValue * config.decayPercent;
  const decrement = Math.max(0, Math.floor(rawDecrease));
  const effectiveDecrease = record.presenceValue <= config.floorValue ? 0 : Math.max(1, decrement);
  const nextValue = Math.max(config.floorValue, record.presenceValue - effectiveDecrease);
  const delta = nextValue - record.presenceValue;
  const reachedFloor = nextValue === config.floorValue;
  const tierId = getPresenceTierIdForValue(nextValue);

  const updated: PlayerPresenceRecord = {
    ...record,
    presenceValue: nextValue,
    tierId,
    updatedAt: now,
    decayState: delta < 0 ? 'decaying' : record.decayState,
    lastVisitedAt: record.lastVisitedAt,
    lastIncrementAt: record.lastIncrementAt
  };

  return {
    updated,
    delta,
    reachedFloor
  };
};
