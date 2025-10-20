export type PresenceDecayState = 'active' | 'decaying' | 'capped';

export interface PlayerPresenceRecord {
  playerId: string;
  hexId: string;
  presenceValue: number;
  tierId: number;
  createdAt: Date;
  updatedAt: Date;
  lastVisitedAt: Date;
  lastIncrementAt: Date;
  decayState: PresenceDecayState;
}

export interface PresenceTierDefinition {
  tierId: number;
  minValue: number;
  label: string;
  colorHint: string;
}

export interface PresenceUpdateEvent {
  hexId: string;
  delta: number;
  newValue: number;
  reason: 'create' | 'increment' | 'decay' | 'cap' | 'anomaly';
  tierAfter: number;
  timestamp: number;
}

export interface PresenceAnomalyRecord {
  playerId: string;
  hexId: string;
  anomalyType: 'oscillation' | 'rate' | 'other';
  valueBefore: number;
  valueAfter: number;
  createdAt: Date;
}
