import type { Pool } from 'pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
import type { MetricsEvent } from '../../src/metrics/adapter.js';
import { setMetricsAdapter } from '../../src/metrics/adapter.js';
import { WorldRoom } from '../../src/rooms/WorldRoom.js';
import { PresenceDao } from '../../src/state/presenceDao.js';
import type { PresenceDecayState } from '../../src/state/presenceTypes.js';
import { getPresenceTierConfig, resetPresenceTierConfig } from '../../src/state/presenceTiers.js';
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

class FakePool {
  private readonly rows = new Map<string, FakeRow>();

  private key(playerId: string, hexId: string): string {
    return `${playerId}|${hexId}`;
  }

  async query(query: string | { text: string; values?: unknown[] }, values?: unknown[]) {
    const text = typeof query === 'string' ? query : query.text;
    const params = values ?? (typeof query === 'string' ? [] : query.values ?? []);
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
        params as [
          string,
          string,
          number,
          number,
          PresenceDecayState,
          Date,
          Date,
          Date,
          Date
        ];

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
        // noop
      }
    };
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

describe('presence cap integration', () => {
  const originalConfig = clonePresenceConfig();
  let metricsEvents: MetricsEvent[];

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

  beforeEach(() => {
    metricsEvents = [];
    installMetricsSpy();

    env.presence.cap = 3;
    env.presence.intervalMs = 1_000;
    env.presence.dwellFraction = 0.9;
    resetPresenceTierConfig();
    getPresenceTierConfig();
  });

  afterEach(() => {
    resetMetricsSpy();
    restorePresenceConfig(originalConfig);
  });

  it('emits cap update and metric when presence reaches the configured cap', async () => {
    const clock = createPresenceTestClock(Date.UTC(2025, 0, 1));
    await loadTestWorld();
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

    const client = new MockClient('session-cap');
    await room.onJoin(client as unknown as import('colyseus').Client, {
      playerId: 'player-cap',
      protocolVersion: env.protocolVersion
    });

    await room.recordMovementSample(client.sessionId, 'hex:7:7');

    const firstUpdate = client.messages.at(-1);
    expect(firstUpdate?.type).toBe('envelope');
    const createEnvelope = firstUpdate?.payload as {
      type: string;
      payload: { reason: string; newValue: number };
    };
    expect(createEnvelope?.type).toBe('presence:update');
    expect(createEnvelope?.payload.reason).toBe('create');

    for (let i = 0; i < 2; i += 1) {
      clock.advance(env.presence.intervalMs);
      await (room as unknown as { processPresenceTick: () => Promise<void> }).processPresenceTick();
    }

    const capMessage = client.messages.at(-1);
    expect(capMessage?.type).toBe('envelope');
    const capEnvelope = capMessage?.payload as {
      type: string;
      payload:
        | { reason: string; newValue: number }
        | { entries: Array<{ reason: string; newValue: number }>; ts: number };
    };

    if (!capEnvelope) {
      throw new Error('expected a presence update message');
    }

    if (capEnvelope.type === 'presence:update') {
      const singlePayload = capEnvelope.payload as { reason: string; newValue: number };
      expect(singlePayload.reason).toBe('cap');
      expect(singlePayload.newValue).toBe(env.presence.cap);
    } else {
      expect(capEnvelope.type).toBe('presence:update.bundled');
      const bundled = (capEnvelope.payload as { entries: Array<{ reason: string; newValue: number }> }).entries;
      const capEntry = bundled.find((entry) => entry.reason === 'cap');
      expect(capEntry).toBeDefined();
      expect(capEntry?.newValue).toBe(env.presence.cap);
    }

    const capMetric = metricsEvents.find((event) => event.name === 'presence_caps_total');
    expect(capMetric).toBeDefined();
    expect(capMetric?.dimensions).toMatchObject({
      playerId: 'player-cap',
      roomId: room.roomId
    });

    const messagesBeforeExtraTick = client.messages.length;

    clock.advance(env.presence.intervalMs);
    await (room as unknown as { processPresenceTick: () => Promise<void> }).processPresenceTick();

    expect(client.messages.length).toBe(messagesBeforeExtraTick);

    room.onLeave(client as unknown as import('colyseus').Client);
    room.onDispose();
  });
});
