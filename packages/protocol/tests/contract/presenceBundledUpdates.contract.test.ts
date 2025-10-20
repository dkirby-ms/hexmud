import { describe, expect, test } from 'vitest';

import {
  createEnvelope,
  presenceBundledUpdateMessageSchema
} from '../../src/index.js';

describe('presence bundled update message contract', () => {
  test('accepts bundled updates with valid entries', () => {
    const envelope = createEnvelope('presence:update.bundled', {
      ts: 1_696_000_050_000,
      entries: [
        {
          hexId: 'hex:1:1',
          delta: 2,
          newValue: 6,
          reason: 'increment',
          tierAfter: 2,
          ts: 1_696_000_049_900
        },
        {
          hexId: 'hex:1:2',
          delta: 1,
          newValue: 3,
          reason: 'create',
          tierAfter: 1,
          ts: 1_696_000_049_950
        }
      ]
    });

    const result = presenceBundledUpdateMessageSchema.safeParse(envelope);
    expect(result.success).toBe(true);
  });

  test('rejects bundles with no entries', () => {
    const envelope = createEnvelope('presence:update.bundled', {
      ts: 1_696_000_050_000,
      entries: []
    });

    const result = presenceBundledUpdateMessageSchema.safeParse(envelope);
    expect(result.success).toBe(false);
  });

  test('rejects zero delta for increment and decay reasons', () => {
    const zeroDeltaIncrement = createEnvelope('presence:update.bundled', {
      ts: 1_696_000_050_000,
      entries: [
        {
          hexId: 'hex:1:3',
          delta: 0,
          newValue: 8,
          reason: 'increment',
          tierAfter: 2,
          ts: 1_696_000_049_880
        }
      ]
    });

    const incrementResult = presenceBundledUpdateMessageSchema.safeParse(zeroDeltaIncrement);
    expect(incrementResult.success).toBe(false);

    const zeroDeltaDecay = createEnvelope('presence:update.bundled', {
      ts: 1_696_000_050_000,
      entries: [
        {
          hexId: 'hex:1:4',
          delta: 0,
          newValue: 5,
          reason: 'decay',
          tierAfter: 1,
          ts: 1_696_000_049_880
        }
      ]
    });

    const decayResult = presenceBundledUpdateMessageSchema.safeParse(zeroDeltaDecay);
    expect(decayResult.success).toBe(false);
  });
});
