import {
  createEnvelope,
  errorCodeSchema,
  heartbeatPayloadSchema,
  presenceRequestSnapshotPayloadSchema,
  type PresenceErrorPayload,
  type PresenceSnapshotEntry
} from '@hexmud/protocol';
import type { Client } from 'colyseus';
import { Room } from 'colyseus';

import { env } from '../config/env.js';
import {
  JoinRejectedError,
  processJoinRequest,
  type JoinOptions
} from '../handlers/join.js';
import {
  logPresenceAnomaly,
  logPresenceCapReached,
  logPresenceCreate,
  logPresenceDecay,
  logPresenceIncrement,
  logPresenceTierTransition,
  logWorldBoundaryMoveRejected
} from '../logging/events.js';
import type { WorldBoundaryRejectionReason } from '../logging/events.js';
import { logger, loggingContext } from '../logging/logger.js';
import {
  incrementPresenceAnomaly,
  incrementPresenceAnomalyEvaluation,
  incrementPresenceCreate,
  incrementPresenceIncrement,
  recordHexesExploredPerSession,
  recordPresenceAnomalyRatio,
  recordPresenceBatchDuration,
  recordPresenceCapEvent,
  recordPresenceIncrementsPerTick,
  recordPresenceUpdateLatency,
  recordWorldBoundaryRejection
} from '../metrics/adapter.js';
import { HeartbeatRateLimiter } from '../ratelimit/heartbeat.js';
import {
  PresenceAnomalyDetector,
  type PresenceAnomalyDetection
} from '../ratelimit/presenceAnomaly.js';
import type { PresenceDao } from '../state/presenceDao.js';
import type { PresenceDecayEvent } from '../state/presenceDecayProcessor.js';
import { canIncrementPresence } from '../state/presenceEligibility.js';
import { applyPresenceIncrement } from '../state/presenceLifecycle.js';
import { detectTierTransition } from '../state/presenceTierTransition.js';
import type { PlayerPresenceRecord } from '../state/presenceTypes.js';
import { rooms } from '../state/rooms.js';
import { sessions } from '../state/sessions.js';
import type { MessageValidationError } from '../validation/validateMessage.js';
import { validateMessage } from '../validation/validateMessage.js';
import { parseHexId } from '../world/hexId.js';
import { getHexTile, getWorldState, isWorldLoaded } from '../world/index.js';
import type { HexCoordinate, WorldHexTile } from '../world/types.js';

import { presenceReplay } from './presenceReplay.js';

export type PresenceUpdateReason = 'create' | 'increment' | 'decay' | 'cap' | 'anomaly';

export interface PresenceSummaryEntry {
  hexId: string;
  tierId: number;
}

export interface PresenceUpdatePayload {
  hexId: string;
  delta: number;
  newValue: number;
  reason: PresenceUpdateReason;
  tierAfter: number;
  ts: number;
}

export interface PresenceState {
  presenceSummary: {
    tiers: PresenceSummaryEntry[];
  };
}

interface PlayerPresenceData {
  records: Map<string, PlayerPresenceRecord>;
}

interface SessionRuntimeState {
  sessionId: string;
  playerId: string;
  activeHexId: string | null;
  dwellStartedAtMs: number | null;
  lastSampleAtMs: number | null;
  exploredHexes: Set<string>;
}

interface MovementRejectionContext {
  coordinate?: HexCoordinate;
  tile?: WorldHexTile;
}

interface WorldRoomDependencies {
  presenceDao: PresenceDao;
  now?: () => Date;
}

const toSnapshotEntry = (record: PlayerPresenceRecord): PresenceSnapshotEntry => ({
  hexId: record.hexId,
  value: record.presenceValue,
  tierId: record.tierId
});

export class WorldRoom extends Room<PresenceState> {
  private static dependencies: WorldRoomDependencies | null = null;
  private static readonly instances = new Set<WorldRoom>();

  static configure(dependencies: WorldRoomDependencies): void {
    WorldRoom.dependencies = dependencies;
  }

  static async notifyDecay(event: PresenceDecayEvent): Promise<void> {
    const listeners = Array.from(WorldRoom.instances);
    for (const room of listeners) {
      try {
        await room.handleDecayEvent(event);
      } catch (error) {
        logger.error('room.world.decay_event_error', {
          roomId: room.roomId,
          playerId: event.playerId,
          hexId: event.hexId,
          error: error instanceof Error ? error.message : 'unknown'
        });
      }
    }
  }

  private readonly presenceDao: PresenceDao;
  private readonly nowFn: () => Date;
  private readonly playerPresence = new Map<string, PlayerPresenceData>();
  private readonly sessionState = new Map<string, SessionRuntimeState>();
  private readonly clientsBySession = new Map<string, Client>();
  private readonly summaryByHex = new Map<string, PresenceSummaryEntry>();
  private readonly pendingPresenceUpdates = new Map<string, PresenceUpdatePayload[]>();
  private readonly heartbeatLimiter = new HeartbeatRateLimiter(env.heartbeatRateLimit);
  private readonly anomalyDetector = new PresenceAnomalyDetector();
  private readonly anomalyStats = {
    evaluations: 0,
    anomalies: 0,
    lastPublishedAtMs: 0
  };
  private presenceTickHandle: unknown = null;

  constructor() {
    super();
    if (!WorldRoom.dependencies) {
      throw new Error('WorldRoom dependencies not configured');
    }
    this.presenceDao = WorldRoom.dependencies.presenceDao;
    this.nowFn = WorldRoom.dependencies.now ?? (() => new Date());
    WorldRoom.instances.add(this);
  }

  override onCreate(): void {
    rooms.ensure(this.roomId, env.protocolVersion);
    this.setState({
      presenceSummary: {
        tiers: []
      }
    });

    this.onMessage('envelope', (client, raw) => {
      this.handleEnvelopeMessage(client, raw).catch((error) => {
        logger.error('room.world.message_error', {
          error: error instanceof Error ? error.message : 'unknown'
        });
      });
    });

    this.presenceTickHandle = this.setSimulationInterval(() => {
      void this.processPresenceTick().catch((error) => {
        logger.error('room.world.presence_tick_error', {
          error: error instanceof Error ? error.message : 'unknown'
        });
      });
    }, env.presence.intervalMs);
  }

  override async onJoin(client: Client, options: JoinOptions): Promise<void> {
    await loggingContext.withCorrelationId(client.sessionId, async () => {
      let joinContext: Awaited<ReturnType<typeof processJoinRequest>>;

      try {
        joinContext = await processJoinRequest({
          client,
          options,
          expectedProtocolVersion: env.protocolVersion
        });
      } catch (error) {
        if (error instanceof JoinRejectedError) {
          if (error.code === 'VERSION_MISMATCH') {
            logger.warn('room.world.protocol_mismatch', {
              requested: options.protocolVersion,
              expected: env.protocolVersion
            });
          }
        }
        throw error;
      }

      const now = this.nowFn();

      if (joinContext.claims) {
        sessions.upsertIdentity({
          playerId: joinContext.playerId,
          displayName: joinContext.claims.name ?? joinContext.claims.preferred_username,
          roles: joinContext.roles,
          authClaims: joinContext.claims,
          sessionPolicy: {
            allowConcurrent: true
          }
        });
      }

      sessions.createSession({
        sessionId: client.sessionId,
        playerId: joinContext.playerId,
        connectedAt: now,
        lastHeartbeatAt: now,
        connectionState: 'active',
        protocolVersion: joinContext.protocolVersion,
        roomId: this.roomId
      });

      rooms.addSession(this.roomId, client.sessionId, env.protocolVersion);

      this.clientsBySession.set(client.sessionId, client);
      this.sessionState.set(client.sessionId, {
        sessionId: client.sessionId,
        playerId: joinContext.playerId,
        activeHexId: null,
        dwellStartedAtMs: null,
        lastSampleAtMs: null,
        exploredHexes: new Set<string>()
      });

      client.send(
        'envelope',
        createEnvelope('session.welcome', {
          sessionId: client.sessionId,
          playerId: joinContext.playerId,
          protocolVersion: joinContext.protocolVersion,
          build: env.buildNumber
        })
      );

      logger.info('room.world.joined', {
        roomId: this.roomId,
        sessionId: client.sessionId,
        playerId: joinContext.playerId
      });
    });
  }

  override onLeave(client: Client): void {
    loggingContext.setCorrelationId(client.sessionId);
    try {
      const session = this.sessionState.get(client.sessionId);
      if (session) {
        this.anomalyDetector.clear(session.playerId);
        recordHexesExploredPerSession(session.exploredHexes.size, {
          roomId: this.roomId,
          playerId: session.playerId
        });
      }
      this.publishAnomalyRatio(true);
      sessions.removeSession(client.sessionId);
      rooms.removeSession(this.roomId, client.sessionId);
      this.clientsBySession.delete(client.sessionId);
      this.sessionState.delete(client.sessionId);
      this.pendingPresenceUpdates.delete(client.sessionId);
      this.heartbeatLimiter.clear(client.sessionId);

      logger.info('room.world.left', {
        roomId: this.roomId,
        sessionId: client.sessionId
      });
    } finally {
      loggingContext.clearCorrelationId();
    }
  }

  override onDispose(): void {
    if (this.presenceTickHandle && typeof (this.presenceTickHandle as { clear: () => void }).clear === 'function') {
      (this.presenceTickHandle as { clear: () => void }).clear();
    }
    this.presenceTickHandle = null;
    WorldRoom.instances.delete(this);
    this.publishAnomalyRatio(true);
    this.pendingPresenceUpdates.clear();
    this.heartbeatLimiter.clearAll();

    logger.info('room.world.disposed', {
      roomId: this.roomId
    });
  }

  async recordMovementSample(sessionId: string, hexId: string): Promise<void> {
    const session = this.sessionState.get(sessionId);
    if (!session) {
      return;
    }

    const isValidMovement = this.validateMovementTarget(session, hexId);
    if (!isValidMovement) {
      return;
    }

    const now = this.nowFn();
    const nowMs = now.getTime();

    session.lastSampleAtMs = nowMs;

    const playerData = this.ensurePlayerData(session.playerId);
    const priorHex = session.activeHexId;
    const didChangeHex = priorHex !== hexId;

    session.activeHexId = hexId;
    if (didChangeHex || session.dwellStartedAtMs === null) {
      session.dwellStartedAtMs = nowMs;
    }
    session.exploredHexes.add(hexId);

    const existing = playerData.records.get(hexId);
    if (!existing) {
      await this.createPresenceRecordForPlayer(session, hexId, now);
      return;
    }

    const updatedRecord: PlayerPresenceRecord = {
      ...existing,
      updatedAt: now,
      lastVisitedAt: now
    };

    const persisted = await this.presenceDao.savePresenceRecord(updatedRecord);
    playerData.records.set(hexId, persisted);
    this.updateSummaryEntry(persisted);
  }

  private validateMovementTarget(session: SessionRuntimeState, hexId: string): boolean {
    const coordinate = parseHexId(hexId);
    if (!coordinate) {
      this.handleMovementRejection(session, hexId, 'invalid_hex_id');
      return false;
    }

    if (!isWorldLoaded()) {
      logger.warn('room.world.movement_validation_skipped', {
        reason: 'world_not_loaded',
        hexId,
        sessionId: session.sessionId,
        playerId: session.playerId
      });
      return true;
    }

    const tile: WorldHexTile | undefined = getHexTile(coordinate.q, coordinate.r);

    if (!tile) {
      this.handleMovementRejection(session, hexId, 'tile_not_found', { coordinate });
      return false;
    }

    if (!tile.navigable) {
      this.handleMovementRejection(session, hexId, 'tile_not_navigable', {
        coordinate,
        tile
      });
      return false;
    }

    return true;
  }

  private handleMovementRejection(
    session: SessionRuntimeState,
    hexId: string,
    reason: WorldBoundaryRejectionReason,
    context: MovementRejectionContext = {}
  ): void {
    recordWorldBoundaryRejection(reason, {
      roomId: this.roomId,
      sessionId: session.sessionId,
      playerId: session.playerId
    });

    this.sendMovementRejectionFeedback(session, hexId, reason);

    const world = getWorldState();
    const logEvent = logWorldBoundaryMoveRejected({
      worldKey: world.definition.worldKey,
      boundaryPolicy: world.definition.boundaryPolicy,
      playerId: session.playerId,
      sessionId: session.sessionId,
      hexId,
      reason,
      coordinate: context.coordinate,
      regionId: context.tile?.regionId,
      terrain: context.tile?.terrain,
      worldVersion: world.definition.version
    });
    logger.warn(logEvent.type, logEvent);
  }

  private sendMovementRejectionFeedback(
    session: SessionRuntimeState,
    hexId: string,
    reason: WorldBoundaryRejectionReason
  ): void {
    const client = this.clientsBySession.get(session.sessionId);
    if (!client) {
      return;
    }

    const payload = this.createMovementRejectionPayload(hexId, reason);
    client.send('envelope', createEnvelope('presence:error', payload));
  }

  private createMovementRejectionPayload(hexId: string, reason: WorldBoundaryRejectionReason): PresenceErrorPayload {
    if (reason === 'invalid_hex_id') {
      return {
        code: 'INVALID_PAYLOAD',
        message: `Movement rejected: "${hexId}" is not a valid hex identifier.`
      };
    }

    if (reason === 'tile_not_found') {
      return {
        code: 'NOT_FOUND',
        message: `Movement rejected: ${hexId} is outside the known default world.`
      };
    }

    return {
      code: 'DENIED',
      message: `Movement rejected: ${hexId} cannot be entered.`
    };
  }

  private async handleEnvelopeMessage(client: Client, raw: unknown): Promise<void> {
    try {
      const { envelope, payload } = validateMessage(raw);

      if (envelope.type === 'heartbeat') {
        if (!this.heartbeatLimiter.consume(client.sessionId)) {
          client.send(
            'envelope',
            createEnvelope('error', {
              code: errorCodeSchema.enum.RATE_LIMIT,
              message: 'RATE_LIMIT: heartbeat frequency exceeded'
            })
          );
          return;
        }

        heartbeatPayloadSchema.parse(payload);
        const now = this.nowFn();
        sessions.updateSession(client.sessionId, { lastHeartbeatAt: now });
        client.send('envelope', createEnvelope('heartbeat', {}));
        return;
      }

      if (envelope.type === 'presence:requestSnapshot') {
        presenceRequestSnapshotPayloadSchema.parse(payload);
        await this.handlePresenceSnapshotRequest(client);
        return;
      }

      client.send(
        'envelope',
        createEnvelope('presence:error', {
          code: 'NOT_FOUND',
          message: `Unhandled message type: ${envelope.type}`
        })
      );
      logger.warn('room.world.unhandled_message', {
        sessionId: client.sessionId,
        type: envelope.type
      });
    } catch (error) {
      const validationError = error as MessageValidationError | Error;
      client.send(
        'envelope',
        createEnvelope('presence:error', {
          code: 'INVALID_PAYLOAD',
          message: 'Invalid message'
        })
      );
      logger.warn('room.world.invalid_message', {
        sessionId: client.sessionId,
        error: validationError instanceof Error ? validationError.message : 'unknown'
      });
    }
  }

  private async handlePresenceSnapshotRequest(client: Client): Promise<void> {
    const session = this.sessionState.get(client.sessionId);
    if (!session) {
      client.send(
        'envelope',
        createEnvelope('presence:error', {
          code: 'DENIED',
          message: 'Session not recognised'
        })
      );
      return;
    }

    const playerData = this.ensurePlayerData(session.playerId);
    const records = await this.presenceDao.listPresenceRecords(session.playerId);

    for (const record of records) {
      playerData.records.set(record.hexId, record);
      this.updateSummaryEntry(record);
    }

    const entries = records.map(toSnapshotEntry);

    client.send(
      'envelope',
      createEnvelope('presence:snapshot', {
        entries,
        ts: Date.now()
      })
    );
  }

  private async createPresenceRecordForPlayer(
    session: SessionRuntimeState,
    hexId: string,
    now: Date
  ): Promise<void> {
    const playerData = this.ensurePlayerData(session.playerId);
    const record = await this.presenceDao.ensurePresenceRecord(session.playerId, hexId);

    const updated: PlayerPresenceRecord = {
      ...record,
      updatedAt: now,
      lastVisitedAt: now
    };

    const saved = await this.presenceDao.savePresenceRecord(updated);
    playerData.records.set(hexId, saved);
    this.updateSummaryEntry(saved);

    incrementPresenceCreate({ playerId: session.playerId, roomId: this.roomId });
    presenceReplay.record({
      playerId: session.playerId,
      hexId,
      type: 'create',
      valueAfter: saved.presenceValue,
      timestamp: now.getTime()
    });
    const logEvent = logPresenceCreate({
      playerId: session.playerId,
      hexId,
      presenceValue: saved.presenceValue
    });
    const logContext: Record<string, unknown> = { ...logEvent };
    logger.info(logEvent.type, logContext);
    if (this.clientsBySession.has(session.sessionId)) {
      const payload: PresenceUpdatePayload = {
        hexId,
        delta: saved.presenceValue,
        newValue: saved.presenceValue,
        reason: 'create',
        tierAfter: saved.tierId,
        ts: now.getTime()
      };
      this.queuePresenceUpdate(session.sessionId, payload);
      this.flushPresenceUpdatesForSession(session.sessionId);
    }
  }

  private ensurePlayerData(playerId: string): PlayerPresenceData {
    let data = this.playerPresence.get(playerId);
    if (!data) {
      data = {
        records: new Map()
      };
      this.playerPresence.set(playerId, data);
    }
    return data;
  }

  private queuePresenceUpdate(sessionId: string, payload: PresenceUpdatePayload): void {
    const existing = this.pendingPresenceUpdates.get(sessionId);
    if (existing) {
      existing.push(payload);
      return;
    }
    this.pendingPresenceUpdates.set(sessionId, [payload]);
  }

  private flushPresenceUpdates(): void {
    const sessionIds = Array.from(this.pendingPresenceUpdates.keys());
    for (const sessionId of sessionIds) {
      this.flushPresenceUpdatesForSession(sessionId);
    }
  }

  private flushPresenceUpdatesForSession(sessionId: string): void {
    const updates = this.pendingPresenceUpdates.get(sessionId);
    if (!updates || updates.length === 0) {
      this.pendingPresenceUpdates.delete(sessionId);
      return;
    }

    this.pendingPresenceUpdates.delete(sessionId);

    const client = this.clientsBySession.get(sessionId);
    if (!client) {
      return;
    }

    const sendTime = Date.now();
    for (const update of updates) {
      const latency = Math.max(0, sendTime - update.ts);
      recordPresenceUpdateLatency(latency, {
        roomId: this.roomId,
        reason: update.reason
      });
    }

    if (updates.length === 1) {
      client.send('envelope', createEnvelope('presence:update', updates[0]!));
      return;
    }

    client.send(
      'envelope',
      createEnvelope('presence:update.bundled', {
        entries: updates.map((entry) => ({ ...entry })),
        ts: Date.now()
      })
    );
  }

  private updateSummaryEntry(record: PlayerPresenceRecord): void {
    this.summaryByHex.set(record.hexId, {
      hexId: record.hexId,
      tierId: record.tierId
    });
    this.syncPresenceSummaryState();
  }

  private syncPresenceSummaryState(): void {
    if (!this.state) {
      return;
    }
    this.state.presenceSummary.tiers = Array.from(this.summaryByHex.values());
  }

  private async handleDecayEvent(event: PresenceDecayEvent): Promise<void> {
    const record = await this.presenceDao.getPresenceRecord(event.playerId, event.hexId);
    if (!record) {
      return;
    }

    const playerData = this.ensurePlayerData(event.playerId);
    playerData.records.set(event.hexId, record);
    this.updateSummaryEntry(record);

    const timestamp = this.nowFn().getTime();
    const payloadTemplate: PresenceUpdatePayload = {
      hexId: event.hexId,
      delta: event.delta,
      newValue: record.presenceValue,
      reason: 'decay',
      tierAfter: record.tierId,
      ts: timestamp
    };

    for (const session of this.sessionState.values()) {
      if (session.playerId !== event.playerId) {
        continue;
      }
      this.queuePresenceUpdate(session.sessionId, { ...payloadTemplate });
      this.flushPresenceUpdatesForSession(session.sessionId);
    }

    const previousValue = record.presenceValue - event.delta;
    presenceReplay.record({
      playerId: event.playerId,
      hexId: event.hexId,
      type: 'decay',
      valueBefore: previousValue,
      valueAfter: record.presenceValue,
      timestamp
    });

    const logEvent = logPresenceDecay({
      playerId: event.playerId,
      hexId: event.hexId,
      delta: Math.abs(event.delta),
      presenceValue: record.presenceValue
    });
    const logContext: Record<string, unknown> = { ...logEvent };
    logger.info(logEvent.type, logContext);
  }

  private publishAnomalyRatio(force = false): void {
    if (this.anomalyStats.evaluations === 0) {
      return;
    }

    const now = Date.now();
    const shouldPublish =
      force ||
      this.anomalyStats.lastPublishedAtMs === 0 ||
      now - this.anomalyStats.lastPublishedAtMs >= 60_000;

    if (!shouldPublish) {
      return;
    }

    const ratio = this.anomalyStats.anomalies / this.anomalyStats.evaluations;
    recordPresenceAnomalyRatio(ratio, { roomId: this.roomId });
    this.anomalyStats.lastPublishedAtMs = now;
  }

  private handlePresenceAnomaly(
    session: SessionRuntimeState,
    record: PlayerPresenceRecord,
    detection: PresenceAnomalyDetection
  ): void {
    incrementPresenceAnomaly(detection.type, { roomId: this.roomId });

    const payloadTemplate: PresenceUpdatePayload = {
      hexId: record.hexId,
      delta: 0,
      newValue: record.presenceValue,
      reason: 'anomaly',
      tierAfter: record.tierId,
      ts: detection.sample.timestamp
    };

    for (const candidate of this.sessionState.values()) {
      if (candidate.playerId !== session.playerId) {
        continue;
      }
      this.queuePresenceUpdate(candidate.sessionId, { ...payloadTemplate });
      this.flushPresenceUpdatesForSession(candidate.sessionId);
    }

    presenceReplay.record({
      playerId: session.playerId,
      hexId: record.hexId,
      type: 'anomaly',
      valueBefore: detection.priorSample.presenceValue,
      valueAfter: detection.sample.presenceValue,
      timestamp: detection.sample.timestamp
    });

    const logEvent = logPresenceAnomaly({
      playerId: session.playerId,
      hexId: record.hexId,
      anomalyType: detection.type,
      valueBefore: detection.priorSample.presenceValue,
      valueAfter: detection.sample.presenceValue
    });
    const logContext: Record<string, unknown> = {
      ...logEvent,
      reason: detection.reason,
      elapsedMs: detection.elapsedMs,
      delta: detection.delta
    };
    logger.warn(logEvent.type, logContext);
  }

  private async processPresenceTick(): Promise<void> {
    if (this.sessionState.size === 0) {
      return;
    }

    const startedAt = Date.now();
    const now = this.nowFn();
    const nowMs = now.getTime();
    let incrementsThisTick = 0;

    for (const session of this.sessionState.values()) {
      if (!session.activeHexId) {
        continue;
      }

      const playerData = this.playerPresence.get(session.playerId);
      if (!playerData) {
        continue;
      }

      let record = playerData.records.get(session.activeHexId);
      if (!record) {
        record = await this.presenceDao.ensurePresenceRecord(session.playerId, session.activeHexId);
        playerData.records.set(session.activeHexId, record);
        this.updateSummaryEntry(record);
      }

      const dwellStart = session.dwellStartedAtMs ?? nowMs;
      const dwellTimeMs = Math.max(0, nowMs - dwellStart);

      const eligible = canIncrementPresence({
        lastIncrementAt: record.lastIncrementAt,
        now,
        dwellTimeMs
      });

      if (!eligible) {
        continue;
      }

      const incrementResult = applyPresenceIncrement({
        record,
        increment: 1,
        now
      });

      if (incrementResult.delta === 0 && incrementResult.reason === 'capped') {
        continue;
      }

      const persisted = await this.presenceDao.savePresenceRecord(incrementResult.updated);
      playerData.records.set(persisted.hexId, persisted);
      session.dwellStartedAtMs = nowMs;

      incrementsThisTick += 1;
      this.updateSummaryEntry(persisted);
      this.emitPresenceUpdate(session, persisted, incrementResult);
    }

    if (incrementsThisTick > 0) {
      recordPresenceIncrementsPerTick(incrementsThisTick, {
        roomId: this.roomId
      });
    }

    this.flushPresenceUpdates();

    const durationMs = Date.now() - startedAt;
    recordPresenceBatchDuration(durationMs, {
      batchType: 'presence_tick',
      roomId: this.roomId
    });
  }

  private emitPresenceUpdate(
    session: SessionRuntimeState,
    record: PlayerPresenceRecord,
    result: ReturnType<typeof applyPresenceIncrement>
  ): void {
    const client = this.clientsBySession.get(session.sessionId);
    if (!client) {
      return;
    }

    const payload: PresenceUpdatePayload = {
      hexId: record.hexId,
      delta: result.delta,
      newValue: record.presenceValue,
      reason: result.reason === 'capped' ? 'cap' : result.reason,
      tierAfter: record.tierId,
      ts: Date.now()
    };

    this.queuePresenceUpdate(session.sessionId, payload);

    const previousValue = Math.max(0, payload.newValue - result.delta);
    const tierTransition = detectTierTransition({
      previousValue,
      nextValue: payload.newValue
    });

    if (result.reason === 'increment') {
      incrementPresenceIncrement({ playerId: session.playerId, roomId: this.roomId });
      presenceReplay.record({
        playerId: session.playerId,
        hexId: record.hexId,
        type: 'increment',
        valueBefore: previousValue,
        valueAfter: record.presenceValue,
        timestamp: payload.ts
      });
      const logEvent = logPresenceIncrement({
        playerId: session.playerId,
        hexId: record.hexId,
        delta: result.delta,
        presenceValue: record.presenceValue
      });
      const logContext: Record<string, unknown> = { ...logEvent };
      logger.info(logEvent.type, logContext);
    } else if (result.reason === 'cap') {
      recordPresenceCapEvent({ playerId: session.playerId, roomId: this.roomId });
      presenceReplay.record({
        playerId: session.playerId,
        hexId: record.hexId,
        type: 'cap',
        valueBefore: previousValue,
        valueAfter: record.presenceValue,
        timestamp: payload.ts
      });
      const logEvent = logPresenceCapReached({
        playerId: session.playerId,
        hexId: record.hexId,
        capValue: record.presenceValue
      });
      const logContext: Record<string, unknown> = { ...logEvent };
      logger.info(logEvent.type, logContext);
    }

    if (tierTransition) {
      presenceReplay.record({
        playerId: session.playerId,
        hexId: record.hexId,
        type: 'tier-transition',
        valueBefore: previousValue,
        valueAfter: payload.newValue,
        tierFrom: tierTransition.fromTierId,
        tierTo: tierTransition.toTierId,
        transitionDirection: tierTransition.direction,
        timestamp: payload.ts
      });

      const logEvent = logPresenceTierTransition({
        playerId: session.playerId,
        hexId: record.hexId,
        fromTier: tierTransition.fromTierId,
        toTier: tierTransition.toTierId,
        direction: tierTransition.direction,
        presenceValue: payload.newValue
      });
      const logContext: Record<string, unknown> = { ...logEvent };
      logger.info(logEvent.type, logContext);
    }

    const anomalyDetection = this.anomalyDetector.evaluate({
      playerId: session.playerId,
      hexId: record.hexId,
      presenceValue: record.presenceValue,
      timestamp: payload.ts
    });

    this.anomalyStats.evaluations += 1;
    incrementPresenceAnomalyEvaluation({ roomId: this.roomId });

    if (anomalyDetection) {
      this.anomalyStats.anomalies += 1;
      this.publishAnomalyRatio(true);
      this.handlePresenceAnomaly(session, record, anomalyDetection);
      return;
    }

    this.publishAnomalyRatio();
  }
}
