import { describe, expect, it } from 'vitest';

import {
  detectTierTransition,
  resolveTierIdForValue,
  type TierTransitionDetectionInput
} from '../../src/state/presenceTierTransition.js';
import type { PresenceTierDefinition } from '../../src/state/presenceTypes.js';

const tiers: PresenceTierDefinition[] = [
  { tierId: 0, minValue: 1, label: 'Trace', colorHint: '#fff' },
  { tierId: 1, minValue: 10, label: 'Footing', colorHint: '#ddd' },
  { tierId: 2, minValue: 25, label: 'Influence', colorHint: '#bbb' },
  { tierId: 3, minValue: 50, label: 'Stronghold', colorHint: '#999' },
  { tierId: 4, minValue: 75, label: 'Dominion', colorHint: '#777' }
];

describe('presence tier transition detection', () => {
  const detect = (input: Omit<TierTransitionDetectionInput, 'tiers'>) =>
    detectTierTransition({ ...input, tiers });

  it('resolves tier id for values across boundaries', () => {
    expect(resolveTierIdForValue(0, tiers)).toBe(0);
    expect(resolveTierIdForValue(9, tiers)).toBe(0);
    expect(resolveTierIdForValue(10, tiers)).toBe(1);
    expect(resolveTierIdForValue(30, tiers)).toBe(2);
    expect(resolveTierIdForValue(70, tiers)).toBe(3);
    expect(resolveTierIdForValue(100, tiers)).toBe(4);
  });

  it('returns null when values remain within same tier', () => {
    expect(detect({ previousValue: 12, nextValue: 18 })).toBeNull();
  });

  it('detects upward tier transition', () => {
    const result = detect({ previousValue: 9, nextValue: 10 });
    expect(result).toEqual({ fromTierId: 0, toTierId: 1, direction: 'up' });
  });

  it('detects multi-level upward tier transition', () => {
    const result = detect({ previousValue: 9, nextValue: 55 });
    expect(result).toEqual({ fromTierId: 0, toTierId: 3, direction: 'up' });
  });

  it('detects downward tier transition', () => {
    const result = detect({ previousValue: 60, nextValue: 20 });
    expect(result).toEqual({ fromTierId: 3, toTierId: 1, direction: 'down' });
  });

  it('handles invalid numeric inputs safely', () => {
    const result = detect({ previousValue: Number.NaN, nextValue: 30 });
    expect(result).toEqual({ fromTierId: 0, toTierId: 2, direction: 'up' });
  });
});
