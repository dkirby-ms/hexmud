import { describe, expect, it } from 'vitest';

import {
  PresenceAnomalyDetector,
  type PresenceEventSample
} from '../../src/ratelimit/presenceAnomaly.js';

describe('PresenceAnomalyDetector oscillation', () => {
  it('detects rapid hex oscillation within window', () => {
    const detector = new PresenceAnomalyDetector({ oscillationWindowMs: 1_000 });

    const firstSample: PresenceEventSample = {
      playerId: 'player-osc',
      hexId: 'hex:A',
      presenceValue: 10,
      timestamp: 1_000
    };

    const secondSample: PresenceEventSample = {
      playerId: 'player-osc',
      hexId: 'hex:B',
      presenceValue: 11,
      timestamp: 1_500
    };

    const initial = detector.evaluate(firstSample);
    expect(initial).toBeNull();

    const detection = detector.evaluate(secondSample);
    expect(detection).not.toBeNull();
    expect(detection?.type).toBe('oscillation');
    expect(detection?.reason).toContain('1000ms');
    expect(detection?.elapsedMs).toBe(500);
    expect(detection?.priorSample.hexId).toBe('hex:A');
    expect(detection?.sample.hexId).toBe('hex:B');
  });

  it('does not flag oscillation when outside window', () => {
    const detector = new PresenceAnomalyDetector({ oscillationWindowMs: 1_000 });

    detector.evaluate({
      playerId: 'player-osc',
      hexId: 'hex:C',
      presenceValue: 5,
      timestamp: 0
    });

    const detection = detector.evaluate({
      playerId: 'player-osc',
      hexId: 'hex:D',
      presenceValue: 6,
      timestamp: 5_000
    });

    expect(detection).toBeNull();
  });
});
