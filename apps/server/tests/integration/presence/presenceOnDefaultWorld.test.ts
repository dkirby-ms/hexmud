import type { Pool } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';

import { formatHexId } from '../../../src/world/hexId.js';
import { PresenceDao } from '../../../src/state/presenceDao.js';
import type { PresenceDecayState } from '../../../src/state/presenceTypes.js';
import { loadTestWorld } from '../../helpers/world.js';

type HexCoordinate = { q: number; r: number };

const qaTraversalPath: HexCoordinate[] = [
  { q: -4, r: 0 },
  { q: -3, r: 0 },
  { q: -2, r: 0 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
  { q: 1, r: 1 },
  { q: 1, r: 2 },
  { q: 2, r: 2 },
  { q: 3, r: 1 },
  { q: 3, r: 0 }
];

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

class RecordingFakePool {
  private readonly rows = new Map<string, FakeRow>();

  private key(playerId: string, hexId: string): string {
    return `${playerId}|${hexId}`;
  }

  async query(query: string | { text: string; values?: unknown[] }, values?: unknown[]) {
    const text = typeof query === 'string' ? query : query.text;
    const params = values ?? (typeof query !== 'string' ? query.values ?? [] : []);
    const trimmed = text.trim();

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

    if (trimmed.startsWith('INSERT INTO player_presence')) {
      const [playerId, hexId, presenceValue, tierId, decayState, createdAt, updatedAt, lastVisitedAt, lastIncrementAt] =
        params as [string, string, number, number, PresenceDecayState, Date, Date, Date, Date];

      const row: FakeRow = {
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
      release: () => {}
    };
  }
}

describe('presence on default world', () => {
  beforeAll(async () => {
    await loadTestWorld();
  });

  it('creates presence records across the QA traversal path', async () => {
    const baseTimestamp = new Date('2025-04-01T00:00:00Z');
    let tick = 0;
    const pool = new RecordingFakePool();
    const dao = new PresenceDao({
      pool: pool as unknown as Pool,
      now: () => new Date(baseTimestamp.getTime() + tick++ * 1000)
    });

    const playerId = 'presence-qa-runner';
    const visitedHexIds = qaTraversalPath.map((step) => formatHexId(step));

    for (const hexId of visitedHexIds) {
      const record = await dao.ensurePresenceRecord(playerId, hexId);
      expect(record.hexId).toBe(hexId);
    }

  const records = await dao.listPresenceRecords(playerId);
  expect(records).toHaveLength(visitedHexIds.length);
  const savedHexIds = records.map((record) => record.hexId).sort();
  const expectedHexIds = [...visitedHexIds].sort();
  expect(savedHexIds).toEqual(expectedHexIds);
  });

  it('rejects attempts to track presence on undefined tiles', async () => {
    const pool = new RecordingFakePool();
    const dao = new PresenceDao({
      pool: pool as unknown as Pool,
      now: () => new Date('2025-04-01T00:00:00Z')
    });

    await expect(dao.ensurePresenceRecord('presence-qa-runner', 'hex:999:999')).rejects.toThrow(
      /undefined world hex/
    );
  });
});
