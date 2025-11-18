import type { Pool } from 'pg';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { canIncrementPresence } from '../../src/state/presenceEligibility.js';
import { applyPresenceIncrement } from '../../src/state/presenceLifecycle.js';
import { PresenceDao } from '../../src/state/presenceDao.js';
import type { PresenceDecayState } from '../../src/state/presenceTypes.js';
import { resetPresenceTierConfig } from '../../src/state/presenceTiers.js';
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

    if (text.trim().startsWith('BEGIN') || text.trim().startsWith('COMMIT')) {
      return { rows: [], rowCount: 0 };
    }

    if (text.trim().startsWith('ROLLBACK')) {
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

    if (text.trim().startsWith('INSERT INTO player_presence')) {
      const [playerId, hexId, presenceValue, tierId, decayState, now, lastVisitedAt, lastIncrementAt] =
        params as [string, string, number, number, PresenceDecayState, Date, Date, Date];

      const row: FakeRow = {
        player_id: playerId,
        hex_id: hexId,
        presence_value: presenceValue,
        tier_id: tierId,
        decay_state: decayState,
        created_at: now,
        updated_at: now,
        last_visited_at: lastVisitedAt,
        last_increment_at: lastIncrementAt
      };

      const existing = this.rows.get(this.key(playerId, hexId));
      if (existing) {
        row.created_at = existing.created_at;
      }

      this.rows.set(this.key(playerId, hexId), row);

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

describe('presence increment integration', () => {
  beforeAll(async () => {
    await loadTestWorld();
  });

  beforeEach(() => {
    resetPresenceTierConfig();
  });

  it('creates and increments presence for dwell intervals', async () => {
    const pool = new FakePool();
    const dao = new PresenceDao({
      pool: pool as unknown as Pool,
      now: () => new Date('2025-01-01T00:00:00Z')
    });

    const playerId = 'player-42';
    const hexId = 'hex:5:7';

    const existing = await dao.getPresenceRecord(playerId, hexId);
    expect(existing).toBeNull();

    const created = await dao.ensurePresenceRecord(playerId, hexId);
    expect(created.presenceValue).toBe(1);

    const dwellSatisfied = canIncrementPresence({
      lastIncrementAt: created.lastIncrementAt,
      now: new Date('2025-01-01T00:00:15Z'),
      dwellTimeMs: 9_000
    });
    expect(dwellSatisfied).toBe(true);

    const increment = applyPresenceIncrement({
      record: created,
      increment: 1,
      now: new Date('2025-01-01T00:00:15Z')
    });

    expect(increment.delta).toBe(1);
    expect(increment.reason).toBe('increment');

    await dao.savePresenceRecord(increment.updated);

    const final = await dao.getPresenceRecord(playerId, hexId);
    expect(final).not.toBeNull();
    expect(final?.presenceValue).toBe(2);
    expect(final?.lastIncrementAt.toISOString()).toBe('2025-01-01T00:00:15.000Z');
  });
});
