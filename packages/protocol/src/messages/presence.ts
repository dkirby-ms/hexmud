export type PresenceUpdateReason = 'create' | 'increment' | 'decay' | 'cap' | 'anomaly';

export type PresenceAnomalyType = 'oscillation' | 'rate' | 'other';

export interface PresenceSummaryEntry {
  hexId: string;
  tierId: number;
}

export interface PresenceSnapshotEntry {
  hexId: string;
  value: number;
  tierId: number;
}

export interface PresenceSnapshotPayload {
  entries: PresenceSnapshotEntry[];
  ts: number;
}

export interface PresenceUpdatePayload {
  hexId: string;
  delta: number;
  newValue: number;
  reason: PresenceUpdateReason;
  tierAfter: number;
  ts: number;
}

export interface PresenceBundledUpdatePayload {
  entries: PresenceUpdatePayload[];
  ts: number;
}

export interface PresenceAnomalyPayload {
  hexId: string;
  type: PresenceAnomalyType;
  valueBefore: number;
  valueAfter: number;
  ts: number;
}

export type PresenceErrorCode =
  | 'DENIED'
  | 'INVALID_PAYLOAD'
  | 'TOO_FREQUENT'
  | 'NOT_FOUND';

export interface PresenceErrorPayload {
  code: PresenceErrorCode;
  message: string;
}

export interface PresenceRequestSnapshotPayload {
  since?: number;
}

export interface PresenceDebugRequestPayload {
  playerId?: string;
  hexId?: string;
}

export interface PresenceDebugDataPayload {
  entries: PresenceSnapshotEntry[];
  playerId?: string;
  hexId?: string;
  ts: number;
}
