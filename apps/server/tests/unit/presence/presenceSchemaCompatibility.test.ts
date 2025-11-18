import { describe, expect, it } from 'vitest';

import { createInitialPresenceRecord } from '../../../src/state/presenceLifecycle.js';
import type { PlayerPresenceRecord } from '../../../src/state/presenceTypes.js';
import { formatHexId } from '../../../src/world/hexId.js';

const expectedPresenceKeys: Array<keyof PlayerPresenceRecord> = [
  'playerId',
  'hexId',
  'presenceValue',
  'tierId',
  'createdAt',
  'updatedAt',
  'lastVisitedAt',
  'lastIncrementAt',
  'decayState'
];

describe('presence schema compatibility', () => {
  it('retains the existing PlayerPresenceRecord shape for default world hexes', () => {
    const now = new Date('2025-04-01T00:00:00Z');
    const record = createInitialPresenceRecord({
      playerId: 'player-alpha',
      hexId: formatHexId({ q: -4, r: 0 }),
      now
    });

    const sortedKeys = Object.keys(record).sort();
    const expectedSortedKeys = [...expectedPresenceKeys].sort();

    expect(sortedKeys).toEqual(expectedSortedKeys);
    expect(record).not.toHaveProperty('worldId');
    expect(record).not.toHaveProperty('regionId');
    expect(record.hexId).toBe('hex:-4:0');
    expect(record.createdAt.toISOString()).toBe(now.toISOString());
  });
});
