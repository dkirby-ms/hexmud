import { describe, expect, test } from 'vitest';

import {
  createEnvelope,
  presenceSnapshotMessageSchema
} from '../../src/index.js';

describe('presence snapshot message contract', () => {
  test('accepts valid snapshot payload', () => {
    const envelope = createEnvelope('presence:snapshot', {
      entries: [
        { hexId: 'hex:0:0', value: 12, tierId: 2 },
        { hexId: 'hex:0:1', value: 4, tierId: 1 }
      ],
      ts: 1_696_000_000_000
    });

    const result = presenceSnapshotMessageSchema.safeParse(envelope);
    expect(result.success).toBe(true);
  });

  test('rejects invalid hex identifier', () => {
    const envelope = createEnvelope('presence:snapshot', {
      entries: [{ hexId: 'invalid hex', value: 10, tierId: 1 }],
      ts: 1_696_000_000_000
    });

    const result = presenceSnapshotMessageSchema.safeParse(envelope);
    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected validation failure');
    }
    expect(result.error.issues[0]?.message).toContain('Invalid hex identifier');
  });

  test('rejects zero or negative snapshot values', () => {
    const impossibleZero = createEnvelope('presence:snapshot', {
  entries: [{ hexId: 'hex:0:2', value: 0, tierId: 0 }],
      ts: 1_696_000_000_000
    });

    const zeroResult = presenceSnapshotMessageSchema.safeParse(impossibleZero);
    expect(zeroResult.success).toBe(false);

    const negative = createEnvelope('presence:snapshot', {
  entries: [{ hexId: 'hex:0:3', value: -4, tierId: 1 }],
      ts: 1_696_000_000_000
    });

    const negativeResult = presenceSnapshotMessageSchema.safeParse(negative);
    expect(negativeResult.success).toBe(false);
  });
});
