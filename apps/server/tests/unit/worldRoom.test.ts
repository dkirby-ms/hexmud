import type { PresenceSnapshotEntry } from '@hexmud/protocol';
import type { Pool } from 'pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MetricsEvent } from '../../src/metrics/adapter.js';
import { setMetricsAdapter } from '../../src/metrics/adapter.js';

vi.mock('../../src/handlers/join.js', async () => {
  const actual = await vi.importActual<typeof import('../../src/handlers/join.js')>(
    '../../src/handlers/join.js'
  );

  return {
    ...actual,
    processJoinRequest: async ({
      client,
      options,
      expectedProtocolVersion
    }: {
      client: { sessionId: string };
      options: { playerId?: string };
      expectedProtocolVersion: number;
    }) => ({
      playerId: options.playerId ?? client.sessionId,
      protocolVersion: expectedProtocolVersion,
      claims: undefined,
      roles: []
    })
  };
});

import { env } from '../../src/config/env.js';
import { WorldRoom } from '../../src/rooms/WorldRoom.js';
import { PresenceDao } from '../../src/state/presenceDao.js';
import type { PresenceDecayState, PlayerPresenceRecord } from '../../src/state/presenceTypes.js';
import { resetPresenceTierConfig } from '../../src/state/presenceTiers.js';
import { createPresenceTestClock } from '../helpers/presence.js';
import { loadTestWorld } from '../helpers/world.js';

interface FakeRow {
  player_id: string;
  hex_id: string;
  presence_value: number;
  tier_id: number;
  decay_state: PresenceDecayState;
  created_at: Date;
  updated_at: Date;
  last_visited_at: Date;
  last_increment_at: Date;
}

class FakePool {
  private readonly rows = new Map<string, FakeRow>();

  private key(playerId: string, hexId: string): string {
    return `${playerId}|${hexId}`;
  }

  async query(query: string | { text: string; values?: unknown[] }, values?: unknown[]) {
    const text = typeof query === 'string' ? query : query.text;
    const params = values ?? (typeof query !== 'string' ? query.values ?? [] : []);
    const trimmed = text.trim().toUpperCase();

    if (trimmed.startsWith('BEGIN') || trimmed.startsWith('COMMIT') || trimmed.startsWith('ROLLBACK')) {
      return { rows: [], rowCount: 0 };
    }

    if (text.includes('WHERE player_id = $1 AND hex_id = $2')) {
      const [playerId, hexId] = params as [string, string];
      const row = this.rows.get(this.key(playerId, hexId));
      return {
        rows: row ? [this.clone(row)] : [],
        rowCount: row ? 1 : 0
      };
    }

    if (text.includes('WHERE player_id = $1') && text.includes('ORDER BY last_visited_at DESC')) {
      const [playerId] = params as [string];
      const rows = Array.from(this.rows.values())
        .filter((row) => row.player_id === playerId)
        .sort((a, b) => b.last_visited_at.getTime() - a.last_visited_at.getTime())
        .map((row) => this.clone(row));
      return {
        rows,
        rowCount: rows.length
      };
    }

    if (trimmed.startsWith('INSERT INTO PLAYER_PRESENCE')) {
      const [playerId, hexId, presenceValue, tierId, decayState, createdAt, updatedAt, lastVisitedAt, lastIncrementAt] =
        params as [string, string, number, number, PresenceDecayState, Date, Date, Date, Date];

      const key = this.key(playerId, hexId);
      const existing = this.rows.get(key);
      const row: FakeRow = existing
        ? {
            ...existing,
            presence_value: presenceValue,
            tier_id: tierId,
            decay_state: decayState,
            updated_at: updatedAt,
            last_visited_at: lastVisitedAt,
            last_increment_at: lastIncrementAt
          }
        : {
            player_id: playerId,
            hex_id: hexId,
            presence_value: presenceValue,
            tier_id: tierId,
            decay_state: decayState,
            created_at: createdAt,
            updated_at: updatedAt,
            last_visited_at: lastVisitedAt,
            last_increment_at: lastIncrementAt
          };

      this.rows.set(key, this.clone(row));

      return {
        rows: [this.clone(row)],
        rowCount: 1
      };
    }

    throw new Error(`Unhandled query: ${text}`);
  }

  async connect() {
    return {
      query: this.query.bind(this),
      release: () => {
        // no-op
      }
    };
  }

  get(playerId: string, hexId: string): PlayerPresenceRecord | undefined {
    const row = this.rows.get(this.key(playerId, hexId));
    return row ? this.mapRowToRecord(this.clone(row)) : undefined;
  }

  private clone(row: FakeRow): FakeRow {
    return {
      ...row,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      last_visited_at: new Date(row.last_visited_at),
      last_increment_at: new Date(row.last_increment_at)
    };
  }

  private mapRowToRecord(row: FakeRow): PlayerPresenceRecord {
    return {
      playerId: row.player_id,
      hexId: row.hex_id,
      presenceValue: row.presence_value,
      tierId: row.tier_id,
      decayState: row.decay_state,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      lastVisitedAt: new Date(row.last_visited_at),
      lastIncrementAt: new Date(row.last_increment_at)
    };
  }
}

class MockClient {
  readonly sessionId: string;
  readonly messages: Array<{ type: string; payload: unknown }> = [];

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  send(type: string, payload: unknown): void {
    this.messages.push({ type, payload });
  }
}

describe('WorldRoom presence flow', () => {
  let metricsEvents: MetricsEvent[] = [];

  const installMetricsSpy = () => {
    setMetricsAdapter({
      emit: async (event) => {
        metricsEvents.push(event);
      }
    });
  };

  const resetMetricsSpy = () => {
    setMetricsAdapter({
      emit: async () => {
        // noop
      }
    });
  };

  beforeEach(async () => {
    metricsEvents = [];
    installMetricsSpy();
    resetPresenceTierConfig();
    await loadTestWorld();
  });

  afterEach(() => {
    resetMetricsSpy();
  });

  it('sends presence snapshot and updates summary state', async () => {
    const clock = createPresenceTestClock(Date.UTC(2025, 0, 1));
    const pool = new FakePool();
    const dao = new PresenceDao({
      pool: pool as unknown as Pool,
      now: () => new Date(clock.now())
    });
    WorldRoom.configure({
      presenceDao: dao,
      now: () => new Date(clock.now())
    });

    const room = new WorldRoom();
    room.onCreate();

    const client = new MockClient('session-1');
    await room.onJoin(client as unknown as import('colyseus').Client, {
      playerId: 'player-1',
      protocolVersion: env.protocolVersion
    });

    const ensured = await dao.ensurePresenceRecord('player-1', 'hex:1:1');
    ensured.presenceValue = 5;
    ensured.tierId = 2;
    ensured.updatedAt = new Date(clock.now());
    ensured.lastVisitedAt = ensured.updatedAt;
    await dao.savePresenceRecord(ensured);

    await (room as unknown as {
      handlePresenceSnapshotRequest: (client: MockClient, payload: unknown) => Promise<void>;
    }).handlePresenceSnapshotRequest(client, {});

    const lastMessage = client.messages.at(-1);
    expect(lastMessage?.type).toBe('envelope');
    const envelope = lastMessage?.payload as {
      type: string;
      payload: { entries: PresenceSnapshotEntry[] };
    };
    expect(envelope.type).toBe('presence:snapshot');
    expect(envelope.payload.entries).toHaveLength(1);
    expect(envelope.payload.entries[0]).toEqual({
      hexId: 'hex:1:1',
      value: 5,
      tierId: 2
    });

    expect(room.state.presenceSummary.tiers).toEqual([
      {
        hexId: 'hex:1:1',
        tierId: 2
      }
    ]);

    room.onLeave(client as unknown as import('colyseus').Client);
    room.onDispose();
  });

  it('records movement samples and emits create update', async () => {
    const clock = createPresenceTestClock(Date.UTC(2025, 0, 1));
    const pool = new FakePool();
    const dao = new PresenceDao({
      pool: pool as unknown as Pool,
      now: () => new Date(clock.now())
    });
    WorldRoom.configure({
      presenceDao: dao,
      now: () => new Date(clock.now())
    });

    const room = new WorldRoom();
    room.onCreate();

    const client = new MockClient('session-2');
    await room.onJoin(client as unknown as import('colyseus').Client, {
      playerId: 'player-2',
      protocolVersion: env.protocolVersion
    });

    await room.recordMovementSample(client.sessionId, 'hex:2:3');

    const lastMessage = client.messages.at(-1);
    expect(lastMessage?.type).toBe('envelope');
    const envelope = lastMessage?.payload as {
      type: string;
      payload: { hexId: string; reason: string };
    };
    expect(envelope.type).toBe('presence:update');
    expect(envelope.payload.hexId).toBe('hex:2:3');
    expect(envelope.payload.reason).toBe('create');

    const record = pool.get('player-2', 'hex:2:3');
    expect(record).toBeDefined();
    expect(room.state.presenceSummary.tiers.some((entry) => entry.hexId === 'hex:2:3')).toBe(true);

    room.onLeave(client as unknown as import('colyseus').Client);
    room.onDispose();
  });

  it('increments presence after dwell threshold', async () => {
    const clock = createPresenceTestClock(Date.UTC(2025, 0, 1));
    const pool = new FakePool();
    const dao = new PresenceDao({
      pool: pool as unknown as Pool,
      now: () => new Date(clock.now())
    });
    WorldRoom.configure({
      presenceDao: dao,
      now: () => new Date(clock.now())
    });

    const room = new WorldRoom();
    room.onCreate();

    const client = new MockClient('session-3');
    await room.onJoin(client as unknown as import('colyseus').Client, {
      playerId: 'player-3',
      protocolVersion: env.protocolVersion
    });

    await room.recordMovementSample(client.sessionId, 'hex:5:5');
    clock.advance(env.presence.intervalMs);

    await (room as unknown as { processPresenceTick: () => Promise<void> }).processPresenceTick();

    const lastMessage = client.messages.at(-1);
    expect(lastMessage?.type).toBe('envelope');
    const envelope = lastMessage?.payload as {
      type: string;
      payload: { reason: string; newValue: number };
    };
    expect(envelope.type).toBe('presence:update');
    expect(envelope.payload.reason).toBe('increment');
    expect(envelope.payload.newValue).toBe(2);

    const record = pool.get('player-3', 'hex:5:5');
    expect(record?.presenceValue).toBe(2);

    room.onLeave(client as unknown as import('colyseus').Client);
    room.onDispose();
  });

  it('records hexes explored per session metric on leave', async () => {
    const clock = createPresenceTestClock(Date.UTC(2025, 0, 1));
    const pool = new FakePool();
    const dao = new PresenceDao({
      pool: pool as unknown as Pool,
      now: () => new Date(clock.now())
    });
    WorldRoom.configure({
      presenceDao: dao,
      now: () => new Date(clock.now())
    });

    const room = new WorldRoom();
    room.onCreate();

    const client = new MockClient('session-metrics');
    await room.onJoin(client as unknown as import('colyseus').Client, {
      playerId: 'player-metrics',
      protocolVersion: env.protocolVersion
    });

    await room.recordMovementSample(client.sessionId, 'hex:10:10');
    await room.recordMovementSample(client.sessionId, 'hex:11:10');

    room.onLeave(client as unknown as import('colyseus').Client);

    const exploredMetric = metricsEvents.find((event) => event.name === 'hexes_explored_per_session');
    expect(exploredMetric).toBeDefined();
    expect(exploredMetric?.value).toBe(2);
    expect(exploredMetric?.dimensions).toMatchObject({
      roomId: room.roomId,
      playerId: 'player-metrics'
    });

    room.onDispose();
  });

  it('rejects movement samples that target unknown coordinates', async () => {
    const clock = createPresenceTestClock(Date.UTC(2025, 0, 1));
    const pool = new FakePool();
    const dao = new PresenceDao({
      pool: pool as unknown as Pool,
      now: () => new Date(clock.now())
    });
    WorldRoom.configure({
      presenceDao: dao,
      now: () => new Date(clock.now())
    });

    const room = new WorldRoom();
    room.onCreate();

    const client = new MockClient('session-boundary');
    await room.onJoin(client as unknown as import('colyseus').Client, {
      playerId: 'player-boundary',
      protocolVersion: env.protocolVersion
    });

    await room.recordMovementSample(client.sessionId, 'hex:999:999');

    const lastMessage = client.messages.at(-1);
    expect(lastMessage?.type).toBe('envelope');
    const envelope = lastMessage?.payload as {
      type: string;
      payload: { code: string; message: string };
    };
    expect(envelope?.type).toBe('presence:error');
    expect(envelope?.payload.code).toBe('NOT_FOUND');
    expect(envelope?.payload.message).toContain('hex:999:999');

    expect(pool.get('player-boundary', 'hex:999:999')).toBeUndefined();

    const boundaryMetric = metricsEvents.find(
      (event) => event.name === 'world_boundary_move_rejections_total'
    );
    expect(boundaryMetric).toBeDefined();
    expect(boundaryMetric?.dimensions).toMatchObject({
      reason: 'tile_not_found',
      playerId: 'player-boundary'
    });

    room.onLeave(client as unknown as import('colyseus').Client);
    room.onDispose();
  });

  it('rejects movement samples on non-navigable tiles', async () => {
    const clock = createPresenceTestClock(Date.UTC(2025, 0, 1));
    const pool = new FakePool();
    const dao = new PresenceDao({
      pool: pool as unknown as Pool,
      now: () => new Date(clock.now())
    });
    WorldRoom.configure({
      presenceDao: dao,
      now: () => new Date(clock.now())
    });

    const room = new WorldRoom();
    room.onCreate();

    const client = new MockClient('session-blocked');
    await room.onJoin(client as unknown as import('colyseus').Client, {
      playerId: 'player-blocked',
      protocolVersion: env.protocolVersion
    });

    await room.recordMovementSample(client.sessionId, 'hex:0:0');

    const lastMessage = client.messages.at(-1);
    expect(lastMessage?.type).toBe('envelope');
    const envelope = lastMessage?.payload as {
      type: string;
      payload: { code: string; message: string };
    };
    expect(envelope?.type).toBe('presence:error');
    expect(envelope?.payload.code).toBe('DENIED');
    expect(envelope?.payload.message).toContain('hex:0:0');

    expect(pool.get('player-blocked', 'hex:0:0')).toBeUndefined();

    const boundaryMetric = metricsEvents.find(
      (event) => event.name === 'world_boundary_move_rejections_total'
    );
    expect(boundaryMetric).toBeDefined();
    expect(boundaryMetric?.dimensions).toMatchObject({
      reason: 'tile_not_navigable',
      playerId: 'player-blocked'
    });

    room.onLeave(client as unknown as import('colyseus').Client);
    room.onDispose();
  });

  it('rejects movement samples with invalid hex identifiers', async () => {
    const clock = createPresenceTestClock(Date.UTC(2025, 0, 1));
    const pool = new FakePool();
    const dao = new PresenceDao({
      pool: pool as unknown as Pool,
      now: () => new Date(clock.now())
    });
    WorldRoom.configure({
      presenceDao: dao,
      now: () => new Date(clock.now())
    });

    const room = new WorldRoom();
    room.onCreate();

    const client = new MockClient('session-invalid');
    await room.onJoin(client as unknown as import('colyseus').Client, {
      playerId: 'player-invalid',
      protocolVersion: env.protocolVersion
    });

    await room.recordMovementSample(client.sessionId, 'not-a-hex');

    const lastMessage = client.messages.at(-1);
    expect(lastMessage?.type).toBe('envelope');
    const envelope = lastMessage?.payload as {
      type: string;
      payload: { code: string; message: string };
    };
    expect(envelope?.type).toBe('presence:error');
    expect(envelope?.payload.code).toBe('INVALID_PAYLOAD');
    expect(envelope?.payload.message).toContain('not-a-hex');

    const boundaryMetric = metricsEvents.find(
      (event) => event.name === 'world_boundary_move_rejections_total'
    );
    expect(boundaryMetric).toBeDefined();
    expect(boundaryMetric?.dimensions).toMatchObject({
      reason: 'invalid_hex_id',
      playerId: 'player-invalid'
    });

    room.onLeave(client as unknown as import('colyseus').Client);
    room.onDispose();
  });
});
