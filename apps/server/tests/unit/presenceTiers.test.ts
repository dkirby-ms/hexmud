import { beforeEach, describe, expect, it } from 'vitest';

import {
  getPresenceTierConfig,
  getPresenceTierIdForValue,
  resetPresenceTierConfig
} from '../../src/state/presenceTiers.js';

const resetConfig = (): void => {
  resetPresenceTierConfig();
  getPresenceTierConfig();
};

describe('presence tiers', () => {
  beforeEach(() => {
    resetConfig();
  });

  it('returns the lowest tier for non-positive values', () => {
    const config = getPresenceTierConfig();
    const lowestTierId = config.tiers[0]?.tierId ?? 0;

    expect(getPresenceTierIdForValue(0)).toBe(lowestTierId);
    expect(getPresenceTierIdForValue(-10)).toBe(lowestTierId);
  expect(getPresenceTierIdForValue(Number.NaN)).toBe(lowestTierId);
  });

  it('maps values to the expected tier boundaries', () => {
    const config = getPresenceTierConfig();

    for (const [index, tier] of config.tiers.entries()) {
      expect(getPresenceTierIdForValue(tier.minValue)).toBe(tier.tierId);

      if (index > 0) {
        expect(getPresenceTierIdForValue(tier.minValue - 1)).toBe(config.tiers[index - 1]?.tierId ?? 0);
      }
    }
  });

  it('floors fractional presence values when comparing tiers', () => {
    const config = getPresenceTierConfig();
    const midTier = config.tiers.at(2);
    if (!midTier) {
      throw new Error('expected mid tier to exist');
    }

    expect(getPresenceTierIdForValue(midTier.minValue + 0.8)).toBe(midTier.tierId);
    expect(getPresenceTierIdForValue(midTier.minValue - 0.2)).toBe(config.tiers[1]?.tierId ?? midTier.tierId);
  });
});
