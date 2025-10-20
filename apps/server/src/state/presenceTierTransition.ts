import { getPresenceTierConfig } from './presenceTiers.js';
import type { PresenceTierDefinition } from './presenceTypes.js';

export type TierTransitionDirection = 'up' | 'down';

export interface TierTransition {
  fromTierId: number;
  toTierId: number;
  direction: TierTransitionDirection;
}

export interface TierTransitionDetectionInput {
  previousValue: number;
  nextValue: number;
  tiers?: PresenceTierDefinition[];
}

const normalizeValue = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
};

export const resolveTierIdForValue = (
  value: number,
  tiers: PresenceTierDefinition[]
): number => {
  if (tiers.length === 0) {
    return 0;
  }

  const safeValue = normalizeValue(value);
  let resolvedTierId = tiers[0]?.tierId ?? 0;

  for (const tier of tiers) {
    if (safeValue >= tier.minValue) {
      resolvedTierId = tier.tierId;
    } else {
      break;
    }
  }

  return resolvedTierId;
};

export const detectTierTransition = (
  input: TierTransitionDetectionInput
): TierTransition | null => {
  const tiers = input.tiers ?? getPresenceTierConfig().tiers;
  if (!tiers.length) {
    return null;
  }

  const fromTierId = resolveTierIdForValue(input.previousValue, tiers);
  const toTierId = resolveTierIdForValue(input.nextValue, tiers);

  if (fromTierId === toTierId) {
    return null;
  }

  const direction: TierTransitionDirection = toTierId > fromTierId ? 'up' : 'down';

  return {
    fromTierId,
    toTierId,
    direction
  };
};
