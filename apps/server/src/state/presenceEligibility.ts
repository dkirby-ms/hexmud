import { getPresenceTierConfig } from './presenceTiers.js';

export interface IncrementEligibilityInput {
  lastIncrementAt: Date | null;
  now: Date;
  dwellTimeMs: number;
  intervalMs?: number;
  requiredDwellFraction?: number;
}

export const canIncrementPresence = ({
  lastIncrementAt,
  now,
  dwellTimeMs,
  intervalMs,
  requiredDwellFraction
}: IncrementEligibilityInput): boolean => {
  const config = getPresenceTierConfig();
  const effectiveIntervalMs = intervalMs ?? config.intervalMs;
  const dwellThreshold = (requiredDwellFraction ?? config.dwellFraction) * effectiveIntervalMs;

  if (dwellTimeMs < dwellThreshold) {
    return false;
  }

  if (!lastIncrementAt) {
    return true;
  }

  const elapsed = now.getTime() - lastIncrementAt.getTime();
  return elapsed >= effectiveIntervalMs;
};
