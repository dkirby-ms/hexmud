import { env } from '../config/env.js';

import type { PresenceTierDefinition } from './presenceTypes.js';

export interface PresenceTierConfig {
  cap: number;
  floorValue: number;
  decayPercent: number;
  inactivityMs: number;
  intervalMs: number;
  dwellFraction: number;
  tiers: PresenceTierDefinition[];
}

const tierLabels: Array<{ label: string; colorHint: string }> = [
  { label: 'Trace', colorHint: '#E6F4FF' },
  { label: 'Footing', colorHint: '#C7E2FF' },
  { label: 'Influence', colorHint: '#8FB7FF' },
  { label: 'Stronghold', colorHint: '#3F6BFF' },
  { label: 'Dominion', colorHint: '#1630B8' }
];

const tierFractions = [0, 0.1, 0.25, 0.5, 0.75];

const buildTierDefinitions = (cap: number): PresenceTierDefinition[] => {
  const tiers: PresenceTierDefinition[] = [];
  let previousMin = 1;

  for (let index = 0; index < tierLabels.length; index += 1) {
    const fraction = tierFractions[index] ?? 0;
    let minValue = Math.max(1, Math.round(cap * fraction));

    if (index === 0) {
      minValue = 1;
    } else if (index === tierLabels.length - 1) {
      minValue = Math.max(previousMin, cap);
    } else if (minValue <= previousMin) {
      minValue = previousMin + 1;
    }

    tiers.push({
      tierId: index,
      minValue,
      label: tierLabels[index]?.label ?? `Tier ${index}`,
      colorHint: tierLabels[index]?.colorHint ?? '#FFFFFF'
    });

    previousMin = minValue;
  }

  return tiers;
};

let cachedConfig: PresenceTierConfig | null = null;

const computePresenceTierConfig = (): PresenceTierConfig => {
  const cap = Math.max(1, env.presence.cap);
  const floorValue = Math.max(1, Math.ceil(cap * env.presence.floorPercent));
  const tiers = buildTierDefinitions(cap);

  return {
    cap,
    floorValue,
    decayPercent: Math.max(0, env.presence.decayPercent),
    inactivityMs: Math.max(0, env.presence.inactivityMs),
    intervalMs: Math.max(1, env.presence.intervalMs),
    dwellFraction: Math.min(1, Math.max(0, env.presence.dwellFraction)),
    tiers
  };
};

export const getPresenceTierConfig = (): PresenceTierConfig => {
  if (!cachedConfig) {
    cachedConfig = computePresenceTierConfig();
  }
  return cachedConfig;
};

export const resetPresenceTierConfig = (): void => {
  cachedConfig = null;
};

export const getPresenceTierIdForValue = (value: number): number => {
  const config = getPresenceTierConfig();
  const safeValue = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

  let resolvedTierId = config.tiers[0]?.tierId ?? 0;
  for (const tier of config.tiers) {
    if (safeValue >= tier.minValue) {
      resolvedTierId = tier.tierId;
    }
  }

  return resolvedTierId;
};
