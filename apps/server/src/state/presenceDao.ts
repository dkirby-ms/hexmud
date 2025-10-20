import type { Pool, PoolClient, QueryResultRow } from 'pg';

import { createInitialPresenceRecord } from './presenceLifecycle.js';
import type { PlayerPresenceRecord, PresenceDecayState } from './presenceTypes.js';

export interface PresenceDaoDependencies {
  pool: Pool;
  now?: () => Date;
}

interface PresenceRow extends QueryResultRow {
  player_id: string;
  hex_id: string;
  presence_value: number;
  tier_id: number;
  decay_state: PresenceDecayState;
  created_at: Date | string;
  updated_at: Date | string;
  last_visited_at: Date | string;
  last_increment_at: Date | string;
}

const mapTimestamp = (value: Date | string): Date =>
  value instanceof Date ? value : new Date(value);

const mapRowToRecord = (row: PresenceRow): PlayerPresenceRecord => ({
  playerId: row.player_id,
  hexId: row.hex_id,
  presenceValue: Number(row.presence_value),
  tierId: Number(row.tier_id),
  decayState: row.decay_state,
  createdAt: mapTimestamp(row.created_at),
  updatedAt: mapTimestamp(row.updated_at),
  lastVisitedAt: mapTimestamp(row.last_visited_at),
  lastIncrementAt: mapTimestamp(row.last_increment_at)
});

export class PresenceDao {
  private readonly pool: Pool;
  private readonly now: () => Date;

  // Redis scheduling is intentionally deferred; all persistence flows go through PostgreSQL for now.
  constructor({ pool, now }: PresenceDaoDependencies) {
    this.pool = pool;
    this.now = now ?? (() => new Date());
  }

  async withTransaction<T>(handler: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await handler(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getPresenceRecord(playerId: string, hexId: string): Promise<PlayerPresenceRecord | null> {
    const result = await this.pool.query<PresenceRow>(
      `SELECT player_id, hex_id, presence_value, tier_id, decay_state, created_at, updated_at,
              last_visited_at, last_increment_at
       FROM player_presence
       WHERE player_id = $1 AND hex_id = $2`,
      [playerId, hexId]
    );

    if (result.rowCount === 0) {
      return null;
    }

    const [row] = result.rows;
    if (!row) {
      throw new Error('Failed to persist presence record');
    }
    return mapRowToRecord(row);
  }

  async listPresenceRecords(playerId: string): Promise<PlayerPresenceRecord[]> {
    const result = await this.pool.query<PresenceRow>(
      `SELECT player_id, hex_id, presence_value, tier_id, decay_state, created_at, updated_at,
              last_visited_at, last_increment_at
       FROM player_presence
       WHERE player_id = $1
       ORDER BY last_visited_at DESC`,
      [playerId]
    );

    return result.rows.map(mapRowToRecord);
  }

  async savePresenceRecord(record: PlayerPresenceRecord): Promise<PlayerPresenceRecord> {
    const result = await this.pool.query<PresenceRow>(
      `INSERT INTO player_presence (
         player_id, hex_id, presence_value, tier_id, decay_state,
         created_at, updated_at, last_visited_at, last_increment_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (player_id, hex_id)
       DO UPDATE SET
         presence_value = EXCLUDED.presence_value,
         tier_id = EXCLUDED.tier_id,
         decay_state = EXCLUDED.decay_state,
         updated_at = EXCLUDED.updated_at,
         last_visited_at = EXCLUDED.last_visited_at,
         last_increment_at = EXCLUDED.last_increment_at
       RETURNING player_id, hex_id, presence_value, tier_id, decay_state,
                 created_at, updated_at, last_visited_at, last_increment_at`,
      [
        record.playerId,
        record.hexId,
        record.presenceValue,
        record.tierId,
        record.decayState,
        record.createdAt,
        record.updatedAt,
        record.lastVisitedAt,
        record.lastIncrementAt
      ]
    );

    const [row] = result.rows;
    if (!row) {
      throw new Error('Failed to persist presence record');
    }
    return mapRowToRecord(row);
  }

  async ensurePresenceRecord(playerId: string, hexId: string): Promise<PlayerPresenceRecord> {
    const existing = await this.getPresenceRecord(playerId, hexId);
    if (existing) {
      return existing;
    }

    const initial = createInitialPresenceRecord({
      playerId,
      hexId,
      now: this.now()
    });

    return this.savePresenceRecord(initial);
  }
}
