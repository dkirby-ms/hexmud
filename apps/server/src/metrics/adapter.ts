export type MetricsDimensions = Record<string, string>;

export interface MetricsEvent {
  readonly name: string;
  readonly value?: number;
  readonly dimensions?: MetricsDimensions;
  readonly timestamp?: number;
}

export interface MetricsAdapter {
  emit: (event: MetricsEvent) => Promise<void>;
}

class NoopMetricsAdapter implements MetricsAdapter {
  async emit(): Promise<void> {
    // intentionally empty
  }
}

let adapter: MetricsAdapter = new NoopMetricsAdapter();

export const setMetricsAdapter = (next: MetricsAdapter): void => {
  adapter = next;
};

export const metrics = {
  async emit(event: MetricsEvent): Promise<void> {
    await adapter.emit({
      ...event,
      timestamp: event.timestamp ?? Date.now()
    });
  }
};

const fireAndForget = (event: MetricsEvent): void => {
  void metrics.emit(event).catch(() => {
    // Suppress metrics emission errors in baseline implementation.
  });
};

export const recordSessionCreated = (dimensions?: MetricsDimensions): void => {
  fireAndForget({
    name: 'sessions_total',
    value: 1,
    dimensions
  });
};

export const recordActiveSessionCount = (count: number): void => {
  fireAndForget({
    name: 'sessions_active',
    value: count
  });
};
