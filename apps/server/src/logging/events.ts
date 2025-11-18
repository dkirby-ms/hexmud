import type { BoundaryPolicy, HexCoordinate, TerrainType } from '../world/types.js';

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

interface WorldLogEventBase extends Record<string, unknown> {
  worldKey: string;
}

export type WorldLoadFailureReason =
  | 'world_definition_not_found'
  | 'validation_failed'
  | 'unexpected_error';

export type WorldLoadPhase = 'definition' | 'validation' | 'bootstrap';

export type WorldLogEvent =
  | (WorldLogEventBase & {
      type: 'world.default.load.start';
    })
  | (WorldLogEventBase & {
      type: 'world.default.load.success';
      version: number;
      tileCount: number;
      regionCount: number;
      spawnRegionCount: number;
      durationMs: number;
      validationDurationMs: number;
    })
  | (WorldLogEventBase & {
      type: 'world.default.load.failure';
      reason: WorldLoadFailureReason;
      durationMs: number;
      phase: WorldLoadPhase;
      validationErrorCount?: number;
      error?: string;
    })
  | (WorldLogEventBase & {
      type: 'world.default.validation.error';
      errors: string[];
      errorCount: number;
      durationMs: number;
    })
  | (WorldLogEventBase & {
      type: 'world.default.boundary.moveRejected';
      boundaryPolicy: BoundaryPolicy;
      playerId: string;
      sessionId: string;
      hexId: string;
      reason: WorldBoundaryRejectionReason;
      coordinate?: HexCoordinate;
      regionId?: number;
      terrain?: TerrainType;
      worldVersion?: number;
    });

export type WorldLogEventType = WorldLogEvent['type'];

export type WorldBoundaryRejectionReason =
  | 'invalid_hex_id'
  | 'tile_not_found'
  | 'tile_not_navigable';

export const logWorldLoadStart = (params: { worldKey: string }): WorldLogEvent => ({
  type: 'world.default.load.start',
  worldKey: params.worldKey
});

export const logWorldLoadSuccess = (params: {
  worldKey: string;
  version: number;
  tileCount: number;
  regionCount: number;
  spawnRegionCount: number;
  durationMs: number;
  validationDurationMs: number;
}): WorldLogEvent => ({
  type: 'world.default.load.success',
  worldKey: params.worldKey,
  version: params.version,
  tileCount: params.tileCount,
  regionCount: params.regionCount,
  spawnRegionCount: params.spawnRegionCount,
  durationMs: params.durationMs,
  validationDurationMs: params.validationDurationMs
});

export const logWorldLoadFailure = (params: {
  worldKey: string;
  reason: WorldLoadFailureReason;
  durationMs: number;
  phase: WorldLoadPhase;
  validationErrorCount?: number;
  error?: string;
}): WorldLogEvent => ({
  type: 'world.default.load.failure',
  worldKey: params.worldKey,
  reason: params.reason,
  durationMs: params.durationMs,
  phase: params.phase,
  validationErrorCount: params.validationErrorCount,
  error: params.error
});

export const logWorldValidationError = (params: {
  worldKey: string;
  errors: string[];
  durationMs: number;
}): WorldLogEvent => ({
  type: 'world.default.validation.error',
  worldKey: params.worldKey,
  errors: params.errors,
  errorCount: params.errors.length,
  durationMs: params.durationMs
});

export const logWorldBoundaryMoveRejected = (params: {
  worldKey: string;
  boundaryPolicy: BoundaryPolicy;
  playerId: string;
  sessionId: string;
  hexId: string;
  reason: WorldBoundaryRejectionReason;
  coordinate?: HexCoordinate;
  regionId?: number;
  terrain?: TerrainType;
  worldVersion?: number;
}): WorldLogEvent => ({
  type: 'world.default.boundary.moveRejected',
  worldKey: params.worldKey,
  boundaryPolicy: params.boundaryPolicy,
  playerId: params.playerId,
  sessionId: params.sessionId,
  hexId: params.hexId,
  reason: params.reason,
  coordinate: params.coordinate,
  regionId: params.regionId,
  terrain: params.terrain,
  worldVersion: params.worldVersion
});
