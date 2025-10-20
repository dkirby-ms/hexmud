import type { Pool } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
import { createPresenceReplayRecorder } from '../../src/rooms/presenceReplay.js';
import { PresenceDao } from '../../src/state/presenceDao.js';
import { PresenceDecayProcessor } from '../../src/state/presenceDecayProcessor.js';
import type { PresenceDecayState, PlayerPresenceRecord } from '../../src/state/presenceTypes.js';
import {
  getPresenceTierConfig,
  getPresenceTierIdForValue,
  resetPresenceTierConfig
} from '../../src/state/presenceTiers.js';
import { createPresenceTestClock } from '../helpers/presence.js';

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

    if (text.includes('FROM player_presence') && text.includes('ORDER BY last_visited_at ASC') && text.includes('LIMIT $3')) {
      const [cutoff, floorValue, limit] = params as [Date, number, number];
      const eligible = Array.from(this.rows.values())
        .filter((row) => row.last_visited_at.getTime() <= cutoff.getTime() && row.presence_value > floorValue)
        .sort((a, b) => a.last_visited_at.getTime() - b.last_visited_at.getTime())
        .map((row) => this.clone(row));
      return {
        rows: eligible.slice(0, limit),
        rowCount: Math.min(limit, eligible.length)
      };
    }

    if (trimmed.startsWith('UPDATE PLAYER_PRESENCE')) {
      const [presenceValue, tierId, decayState, updatedAt, playerId, hexId] = params as [
        number,
        number,
        PresenceDecayState,
        Date,
        string,
        string
      ];
      const key = this.key(playerId, hexId);
      const existing = this.rows.get(key);
      if (!existing) {
        throw new Error('row not found');
      }
      const updated: FakeRow = {
        ...existing,
        presence_value: presenceValue,
        tier_id: tierId,
        decay_state: decayState,
        updated_at: updatedAt
      };
      this.rows.set(key, this.clone(updated));
      return {
        rows: [this.clone(updated)],
        rowCount: 1
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

  get(playerId: string, hexId: string): PlayerPresenceRecord | undefined {
    const row = this.rows.get(this.key(playerId, hexId));
    if (!row) {
      return undefined;
    }
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

describe('presence replay determinism', () => {
  const originalPresenceConfig = clonePresenceConfig();

  beforeEach(() => {
    restorePresenceConfig(originalPresenceConfig);
  });

  it('records create, increment, and decay events in deterministic order', async () => {
    env.presence.decayPercent = 0.2;
    env.presence.inactivityMs = 1_000;
    resetPresenceTierConfig();

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

    const recorder = createPresenceReplayRecorder();

    const client = {
      sessionId: 'session-replay',
      send: () => {
        // ignore
      }
    } as unknown as import('colyseus').Client;

    await room.onJoin(client, {
      playerId: 'player-replay',
      protocolVersion: env.protocolVersion
    });

    await room.recordMovementSample(client.sessionId, 'hex:9:9');

    clock.advance(env.presence.intervalMs);
    await (room as unknown as { processPresenceTick: () => Promise<void> }).processPresenceTick();

    const stored = pool.get('player-replay', 'hex:9:9');
    expect(stored).toBeDefined();
    if (!stored) {
      throw new Error('expected stored record to exist');
    }

    const config = getPresenceTierConfig();
    const boostedValue = config.floorValue + 5;
    const staleRecord: PlayerPresenceRecord = {
      ...stored,
      presenceValue: boostedValue,
      tierId: getPresenceTierIdForValue(boostedValue),
      lastVisitedAt: new Date(clock.now()),
      lastIncrementAt: new Date(clock.now())
    };

    await dao.savePresenceRecord(staleRecord);

    clock.advance(env.presence.inactivityMs + 100);

    const decayProcessor = new PresenceDecayProcessor({
      presenceDao: dao,
      now: () => new Date(clock.now()),
      onDecay: (event) => WorldRoom.notifyDecay(event)
    });

    await decayProcessor.runBatch();

    const events = recorder.flush();
    expect(events.map((event) => event.type)).toEqual(['create', 'increment', 'decay']);

    const [createEvent, incrementEvent, decayEvent] = events;
    expect(createEvent?.valueAfter).toBe(1);
    expect(incrementEvent?.valueBefore).toBe(1);
    expect(incrementEvent?.valueAfter).toBeGreaterThan(createEvent?.valueAfter ?? 0);
    expect(decayEvent?.valueBefore).toBeGreaterThan(decayEvent?.valueAfter ?? 0);

  recorder.dispose();
  room.onLeave(client);
    room.onDispose();
  });
});
