import type { Pool } from 'pg';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { env } from '../../src/config/env.js';
import { PresenceDao } from '../../src/state/presenceDao.js';
import { PresenceDecayProcessor } from '../../src/state/presenceDecayProcessor.js';
import type { PresenceDecayState } from '../../src/state/presenceTypes.js';
import { applyPresenceIncrement } from '../../src/state/presenceLifecycle.js';
import { getPresenceTierConfig, resetPresenceTierConfig } from '../../src/state/presenceTiers.js';
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
        rows: row ? [row] : [],
        rowCount: row ? 1 : 0
      };
    }

    if (text.includes('WHERE player_id = $1') && text.includes('ORDER BY last_visited_at DESC')) {
      const [playerId] = params as [string];
      const rows = Array.from(this.rows.values()).filter((row) => row.player_id === playerId);
      rows.sort((a, b) => b.last_visited_at.getTime() - a.last_visited_at.getTime());
      return {
        rows,
        rowCount: rows.length
      };
    }

    if (text.includes('FROM player_presence') && text.includes('ORDER BY last_visited_at ASC') && text.includes('LIMIT $3')) {
      const [cutoff, floorValue, limit] = params as [Date, number, number];
      const eligible = Array.from(this.rows.values()).filter((row) => {
        return row.last_visited_at.getTime() <= cutoff.getTime() && row.presence_value > floorValue;
      });
      eligible.sort((a, b) => a.last_visited_at.getTime() - b.last_visited_at.getTime());
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
      const row = this.rows.get(key);
      if (!row) {
        throw new Error('row not found');
      }
      row.presence_value = presenceValue;
      row.tier_id = tierId;
      row.decay_state = decayState;
      row.updated_at = updatedAt;
      return {
        rows: [row],
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
      const row: FakeRow = {
        player_id: playerId,
        hex_id: hexId,
        presence_value: presenceValue,
        tier_id: tierId,
        decay_state: decayState,
        created_at: existing?.created_at ?? createdAt,
        updated_at: updatedAt,
        last_visited_at: lastVisitedAt,
        last_increment_at: lastIncrementAt
      };

      this.rows.set(key, row);

      return {
        rows: [row],
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
}

describe('presence decay integration flow', () => {
  const originalPresenceConfig = clonePresenceConfig();

  beforeAll(async () => {
    await loadTestWorld();
  });

  beforeEach(() => {
    restorePresenceConfig(originalPresenceConfig);
  });

  it('applies decay to stale records and resumes accumulation on re-entry', async () => {
    env.presence.decayPercent = 0.1;
    env.presence.inactivityMs = 1_000;
    resetPresenceTierConfig();

    const pool = new FakePool();
    const dao = new PresenceDao({
      pool: pool as unknown as Pool,
      now: () => new Date('2025-01-01T00:00:00Z')
    });

    const playerId = 'player-42';
    const hexId = 'hex:5:7';

    const created = await dao.ensurePresenceRecord(playerId, hexId);
    const config = getPresenceTierConfig();
    const staleRecord = {
      ...created,
      presenceValue: 50,
      tierId: config.tiers[2]?.tierId ?? created.tierId,
      decayState: 'active' as PresenceDecayState,
      updatedAt: new Date('2025-01-01T00:00:00Z'),
      lastVisitedAt: new Date('2025-01-01T00:00:00Z'),
      lastIncrementAt: new Date('2025-01-01T00:00:00Z')
    };

    await dao.savePresenceRecord(staleRecord);

    const events: Array<{ delta: number; newValue: number }> = [];
    const processor = new PresenceDecayProcessor({
      presenceDao: dao,
      batchSize: 5,
      now: () => new Date('2025-01-01T00:00:02Z'),
      onDecay: (event) => {
        events.push({ delta: event.delta, newValue: event.newValue });
      }
    });

    const summary = await processor.runBatch();
    expect(summary.decayed).toBe(1);
    expect(summary.processed).toBe(1);
    expect(summary.skipped).toBe(0);

    const decayed = await dao.getPresenceRecord(playerId, hexId);
    expect(decayed).not.toBeNull();
    expect(decayed?.presenceValue).toBeLessThan(staleRecord.presenceValue);
    expect(decayed?.decayState).toBe('decaying');
    expect(decayed?.lastVisitedAt.toISOString()).toBe('2025-01-01T00:00:00.000Z');
    expect(events).toHaveLength(1);
    expect(events[0]?.delta).toBeLessThan(0);

    const increment = applyPresenceIncrement({
      record: decayed!,
      increment: 1,
      now: new Date('2025-01-01T00:00:05Z')
    });

    await dao.savePresenceRecord(increment.updated);

    const resumed = await dao.getPresenceRecord(playerId, hexId);
    expect(resumed).not.toBeNull();
    expect(resumed?.decayState).toBe('active');
    expect(resumed?.presenceValue).toBeGreaterThan(decayed!.presenceValue);
    expect(resumed?.lastVisitedAt.toISOString()).toBe('2025-01-01T00:00:05.000Z');
  });
});
