import type { PoolClient } from 'pg';

import { incrementPresenceDecay, recordPresenceBatchDuration } from '../metrics/adapter.js';

import type { PresenceDao } from './presenceDao.js';
import { createDecaySelectionQuery, mapDecayRow } from './presenceDecayQuery.js';
import type { PresenceDecayRow } from './presenceDecayQuery.js';
import { applyPresenceDecay } from './presenceLifecycle.js';
import type { PlayerPresenceRecord } from './presenceTypes.js';

export interface PresenceDecayEvent {
  playerId: string;
  hexId: string;
  delta: number;
  newValue: number;
  reachedFloor: boolean;
}

export interface PresenceDecayBatchResult {
  processed: number;
  decayed: number;
  skipped: number;
}

export interface PresenceDecayProcessorOptions {
  presenceDao: PresenceDao;
  batchSize?: number;
  now?: () => Date;
  onDecay?: (event: PresenceDecayEvent) => void | Promise<void>;
}

export class PresenceDecayProcessor {
  private readonly presenceDao: PresenceDao;
  private readonly batchSize: number;
  private readonly nowFn: () => Date;
  private readonly onDecay?: (event: PresenceDecayEvent) => void | Promise<void>;

  constructor({ presenceDao, batchSize, now, onDecay }: PresenceDecayProcessorOptions) {
    this.presenceDao = presenceDao;
    this.batchSize = Math.max(1, batchSize ?? 100);
    this.nowFn = now ?? (() => new Date());
    this.onDecay = onDecay;
  }

  async runBatch(): Promise<PresenceDecayBatchResult> {
    const startedAt = Date.now();
    const result = await this.presenceDao.withTransaction(async (client) => {
      const now = this.nowFn();
      const selection = await client.query<PresenceDecayRow>(
        createDecaySelectionQuery(this.batchSize, now)
      );
      if (selection.rowCount === 0) {
        return {
          processed: 0,
          decayed: 0,
          skipped: 0
        } satisfies PresenceDecayBatchResult;
      }

      const summary: PresenceDecayBatchResult = {
        processed: selection.rowCount ?? selection.rows.length,
        decayed: 0,
        skipped: 0
      };

      for (const row of selection.rows) {
        const candidate = mapDecayRow(row);
        const record: PlayerPresenceRecord = {
          playerId: candidate.playerId,
          hexId: candidate.hexId,
          presenceValue: candidate.presenceValue,
          tierId: candidate.tierId,
          decayState: candidate.decayState,
          createdAt: candidate.createdAt,
          updatedAt: candidate.updatedAt,
          lastVisitedAt: candidate.lastVisitedAt,
          lastIncrementAt: candidate.lastIncrementAt
        };

        const decayResult = applyPresenceDecay({
          record,
          now
        });

        if (decayResult.delta === 0) {
          summary.skipped += 1;
          continue;
        }

        await this.persistDecay(client, decayResult.updated);

        summary.decayed += 1;

        const event: PresenceDecayEvent = {
          playerId: record.playerId,
          hexId: record.hexId,
          delta: decayResult.delta,
          newValue: decayResult.updated.presenceValue,
          reachedFloor: decayResult.reachedFloor
        };

        incrementPresenceDecay();

        if (this.onDecay) {
          await this.onDecay(event);
        }
      }

      return summary;
    });

    const durationMs = Date.now() - startedAt;
    recordPresenceBatchDuration(durationMs, { batchType: 'presence_decay' });

    return result;
  }

  private async persistDecay(client: PoolClient, record: PlayerPresenceRecord): Promise<void> {
    await client.query(
      `UPDATE player_presence
         SET presence_value = $1,
             tier_id = $2,
             decay_state = $3,
             updated_at = $4
       WHERE player_id = $5 AND hex_id = $6`,
      [
        record.presenceValue,
        record.tierId,
        record.decayState,
        record.updatedAt,
        record.playerId,
        record.hexId
      ]
    );
  }
}
