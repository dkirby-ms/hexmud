import type { Pool } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';

import { PresenceDao } from '../../src/state/presenceDao.js';
import type { PlayerPresenceRecord } from '../../src/state/presenceTypes.js';
import { loadTestWorld } from '../helpers/world.js';

class InMemoryPresenceDao extends PresenceDao {
  private readonly records = new Map<string, PlayerPresenceRecord>();

  constructor() {
    super({ pool: {} as Pool, now: () => new Date('2025-01-01T00:00:00Z') });
  }

  private key(playerId: string, hexId: string): string {
    return `${playerId}|${hexId}`;
  }

  override async getPresenceRecord(playerId: string, hexId: string): Promise<PlayerPresenceRecord | null> {
    return this.records.get(this.key(playerId, hexId)) ?? null;
  }

  override async savePresenceRecord(record: PlayerPresenceRecord): Promise<PlayerPresenceRecord> {
    this.records.set(this.key(record.playerId, record.hexId), record);
    return record;
  }
}

describe('PresenceDao world validation', () => {
  beforeAll(async () => {
    await loadTestWorld();
  });

  it('rejects creation for invalid hex id format', async () => {
    const dao = new InMemoryPresenceDao();
    await expect(dao.ensurePresenceRecord('player-1', 'invalid-hex')).rejects.toThrow(/invalid hexId/i);
  });

  it('rejects creation for coordinates not present in the world', async () => {
    const dao = new InMemoryPresenceDao();
    await expect(dao.ensurePresenceRecord('player-1', 'hex:99:99')).rejects.toThrow(/undefined world hex/i);
  });

  it('creates a record when the world tile exists', async () => {
    const dao = new InMemoryPresenceDao();
    const record = await dao.ensurePresenceRecord('player-1', 'hex:1:1');
    expect(record.hexId).toBe('hex:1:1');
    expect(record.playerId).toBe('player-1');
  });
});
