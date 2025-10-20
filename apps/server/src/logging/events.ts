// Structured log event type definitions for authentication lifecycle.

interface AuthLogEventBase {
  authCorrId?: string;
}

export type AuthLogEvent =
  | (AuthLogEventBase & {
      type: 'auth.signin.success';
      sessionId: string;
      playerId: string;
      source?: 'redirect' | 'popup' | 'silent';
    })
  | (AuthLogEventBase & {
      type: 'auth.signin.failure';
      sessionId: string;
      reason: string;
      stage?: 'interactive' | 'silent';
    })
  | (AuthLogEventBase & {
      type: 'auth.token.validation.failure';
      sessionId: string;
      reason: string;
    })
  | (AuthLogEventBase & {
      type: 'auth.signout';
      sessionId: string;
      playerId: string;
      method?: 'interactive' | 'silent' | 'timeout';
    })
  | (AuthLogEventBase & {
      type: 'auth.renewal.success';
      sessionId: string;
      playerId: string;
      latencyMs?: number;
    })
  | (AuthLogEventBase & {
      type: 'auth.renewal.failure';
      sessionId: string;
      reason: string;
      retryInSeconds?: number;
    });

export type AuthLogEventType = AuthLogEvent['type'];

interface PresenceLogEventBase {
  playerId: string;
  hexId: string;
  presenceValue?: number;
}

export type PresenceLogEvent =
  | (PresenceLogEventBase & {
      type: 'presence.create';
      presenceValue: number;
    })
  | (PresenceLogEventBase & {
      type: 'presence.increment';
      delta: number;
      presenceValue: number;
    })
  | (PresenceLogEventBase & {
      type: 'presence.decay';
      delta: number;
      presenceValue: number;
    })
  | (PresenceLogEventBase & {
      type: 'presence.cap';
      capValue: number;
    })
  | (PresenceLogEventBase & {
      type: 'presence.tierTransition';
      fromTier: number;
      toTier: number;
      direction: 'up' | 'down';
      presenceValue: number;
    })
  | (PresenceLogEventBase & {
      type: 'presence.anomaly';
      anomalyType: 'oscillation' | 'rate' | 'other';
      valueBefore: number;
      valueAfter: number;
    });

export type PresenceLogEventType = PresenceLogEvent['type'];

export const logPresenceCreate = (params: {
  playerId: string;
  hexId: string;
  presenceValue: number;
}): PresenceLogEvent => ({
  type: 'presence.create',
  playerId: params.playerId,
  hexId: params.hexId,
  presenceValue: params.presenceValue
});

export const logPresenceIncrement = (params: {
  playerId: string;
  hexId: string;
  delta: number;
  presenceValue: number;
}): PresenceLogEvent => ({
  type: 'presence.increment',
  playerId: params.playerId,
  hexId: params.hexId,
  delta: params.delta,
  presenceValue: params.presenceValue
});

export const logPresenceDecay = (params: {
  playerId: string;
  hexId: string;
  delta: number;
  presenceValue: number;
}): PresenceLogEvent => ({
  type: 'presence.decay',
  playerId: params.playerId,
  hexId: params.hexId,
  delta: params.delta,
  presenceValue: params.presenceValue
});

export const logPresenceCapReached = (params: {
  playerId: string;
  hexId: string;
  capValue: number;
}): PresenceLogEvent => ({
  type: 'presence.cap',
  playerId: params.playerId,
  hexId: params.hexId,
  capValue: params.capValue
});

export const logPresenceTierTransition = (params: {
  playerId: string;
  hexId: string;
  fromTier: number;
  toTier: number;
  direction: 'up' | 'down';
  presenceValue: number;
}): PresenceLogEvent => ({
  type: 'presence.tierTransition',
  playerId: params.playerId,
  hexId: params.hexId,
  fromTier: params.fromTier,
  toTier: params.toTier,
  direction: params.direction,
  presenceValue: params.presenceValue
});

export const logPresenceAnomaly = (params: {
  playerId: string;
  hexId: string;
  anomalyType: 'oscillation' | 'rate' | 'other';
  valueBefore: number;
  valueAfter: number;
}): PresenceLogEvent => ({
  type: 'presence.anomaly',
  playerId: params.playerId,
  hexId: params.hexId,
  anomalyType: params.anomalyType,
  valueBefore: params.valueBefore,
  valueAfter: params.valueAfter
});
