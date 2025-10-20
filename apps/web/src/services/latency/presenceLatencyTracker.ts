export type PresenceLatencyMessageType = 'single' | 'bundled';

export interface PresenceLatencySample {
  readonly batchSize: number;
  readonly averageLatencyMs: number;
  readonly minLatencyMs: number;
  readonly maxLatencyMs: number;
  readonly observedAt: number;
  readonly messageType: PresenceLatencyMessageType;
}

export type PresenceLatencyObserver = (sample: PresenceLatencySample) => void;

const observers = new Set<PresenceLatencyObserver>();
const history: PresenceLatencySample[] = [];
const HISTORY_LIMIT = 200;

export const observePresenceLatency = (
  observer: PresenceLatencyObserver
): (() => void) => {
  observers.add(observer);
  return () => {
    observers.delete(observer);
  };
};

export const recordPresenceLatencySample = (sample: PresenceLatencySample): void => {
  history.push(sample);
  if (history.length > HISTORY_LIMIT) {
    history.shift();
  }

  for (const observer of observers) {
    observer(sample);
  }
};

export const getPresenceLatencyHistory = (): readonly PresenceLatencySample[] => history.slice();

export const resetPresenceLatencyTracker = (): void => {
  observers.clear();
  history.length = 0;
};
