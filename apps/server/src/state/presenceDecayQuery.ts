import type { QueryConfig } from 'pg';

import { getPresenceTierConfig } from './presenceTiers.js';
import type { PresenceDecayState } from './presenceTypes.js';

export interface PresenceDecayCandidate {
  playerId: string;
  hexId: string;
  presenceValue: number;
  tierId: number;
  decayState: PresenceDecayState;
  createdAt: Date;
  updatedAt: Date;
  lastVisitedAt: Date;
  lastIncrementAt: Date;
}

export interface PresenceDecayRow {
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

export const mapDecayRow = (row: PresenceDecayRow): PresenceDecayCandidate => ({
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

export const createDecaySelectionQuery = (
  limit: number,
  now: Date = new Date()
): QueryConfig => {
  const config = getPresenceTierConfig();
  const cutoff = new Date(now.getTime() - config.inactivityMs);

  return {
    text: `SELECT player_id, hex_id, presence_value, tier_id, decay_state,
                  created_at, updated_at, last_visited_at, last_increment_at
           FROM player_presence
           WHERE decay_state <> 'capped' AND last_visited_at <= $1 AND presence_value > $2
           ORDER BY last_visited_at ASC
           LIMIT $3`,
    values: [cutoff, config.floorValue, limit]
  };
};
