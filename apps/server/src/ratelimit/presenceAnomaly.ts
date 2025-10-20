export interface PresenceEventSample {
  playerId: string;
  hexId: string;
  presenceValue: number;
  timestamp: number;
}

export type PresenceAnomalyType = 'oscillation' | 'rate';

export interface PresenceAnomalyDetection {
  type: PresenceAnomalyType;
  reason: string;
  sample: PresenceEventSample;
  priorSample: PresenceEventSample;
  elapsedMs: number;
  delta: number;
}

export interface PresenceAnomalyDetectorOptions {
  oscillationWindowMs?: number;
  maxDeltaPerSecond?: number;
}

export class PresenceAnomalyDetector {
  private readonly oscillationWindowMs: number;
  private readonly maxDeltaPerSecond: number;
  private readonly state = new Map<string, PresenceEventSample>();

  constructor(options: PresenceAnomalyDetectorOptions = {}) {
    this.oscillationWindowMs = options.oscillationWindowMs ?? 2_000;
    this.maxDeltaPerSecond = options.maxDeltaPerSecond ?? 10;
  }

  evaluate(sample: PresenceEventSample): PresenceAnomalyDetection | null {
    const prior = this.state.get(sample.playerId);
    this.state.set(sample.playerId, { ...sample });

    if (!prior) {
      return null;
    }

    const elapsedMs = sample.timestamp - prior.timestamp;
    const delta = sample.presenceValue - prior.presenceValue;

    const baseContext: Omit<PresenceAnomalyDetection, 'type' | 'reason'> = {
      sample: { ...sample },
      priorSample: { ...prior },
      elapsedMs,
      delta
    };

    if (elapsedMs <= 0) {
      return {
        type: 'rate',
        reason: 'non-increasing timestamp detected',
        ...baseContext
      };
    }

    const switchedHex = sample.hexId !== prior.hexId;
    if (switchedHex && elapsedMs < this.oscillationWindowMs) {
      return {
        type: 'oscillation',
        reason: `hex changed within ${this.oscillationWindowMs}ms`,
        ...baseContext
      };
    }

    const rate = Math.abs(delta) / (elapsedMs / 1_000);
    if (rate > this.maxDeltaPerSecond) {
      return {
        type: 'rate',
        reason: `delta ${Math.abs(delta)} over ${elapsedMs}ms exceeds threshold`,
        ...baseContext
      };
    }

    return null;
  }

  clear(playerId: string): void {
    this.state.delete(playerId);
  }

  reset(): void {
    this.state.clear();
  }
}
