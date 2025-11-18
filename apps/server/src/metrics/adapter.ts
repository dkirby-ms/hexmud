import type { WorldBoundaryRejectionReason } from '../logging/events.js';

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

export const incrementTokenValidationTotal = (dimensions?: MetricsDimensions): void => {
  fireAndForget({
    name: 'auth_token_validation_total',
    value: 1,
    dimensions
  });
};

export const incrementTokenValidationFailure = (
  reason: string,
  dimensions?: MetricsDimensions
): void => {
  fireAndForget({
    name: 'auth_token_validation_failure_total',
    value: 1,
    dimensions: { reason, ...(dimensions ?? {}) }
  });
};

export const incrementSigninSuccess = (dimensions?: MetricsDimensions): void => {
  fireAndForget({
    name: 'auth_signin_success_total',
    value: 1,
    dimensions
  });
};

export const incrementSigninFailure = (
  reason: string,
  dimensions?: MetricsDimensions
): void => {
  fireAndForget({
    name: 'auth_signin_failure_total',
    value: 1,
    dimensions: { reason, ...(dimensions ?? {}) }
  });
};

export const incrementRenewalSuccess = (dimensions?: MetricsDimensions): void => {
  fireAndForget({
    name: 'auth_renewal_success_total',
    value: 1,
    dimensions
  });
};

export const incrementRenewalFailure = (
  reason: string,
  dimensions?: MetricsDimensions
): void => {
  fireAndForget({
    name: 'auth_renewal_failure_total',
    value: 1,
    dimensions: { reason, ...(dimensions ?? {}) }
  });
};

export const recordSigninDuration = (durationMs: number, dimensions?: MetricsDimensions): void => {
  fireAndForget({
    name: 'auth_signin_duration_ms',
    value: durationMs,
    dimensions
  });
};

export const recordRenewalLatency = (latencyMs: number, dimensions?: MetricsDimensions): void => {
  fireAndForget({
    name: 'auth_renewal_latency_ms',
    value: latencyMs,
    dimensions
  });
};

export const incrementPresenceCreate = (dimensions?: MetricsDimensions): void => {
  fireAndForget({
    name: 'presence_creates_total',
    value: 1,
    dimensions
  });
};

export const incrementPresenceIncrement = (dimensions?: MetricsDimensions): void => {
  fireAndForget({
    name: 'presence_increments_total',
    value: 1,
    dimensions
  });
};

export const incrementPresenceDecay = (dimensions?: MetricsDimensions): void => {
  fireAndForget({
    name: 'presence_decays_total',
    value: 1,
    dimensions
  });
};

export const incrementPresenceAnomaly = (
  anomalyType: string,
  dimensions?: MetricsDimensions
): void => {
  fireAndForget({
    name: 'presence_anomalies_total',
    value: 1,
    dimensions: { anomalyType, ...(dimensions ?? {}) }
  });
};

export const incrementPresenceAnomalyEvaluation = (
  dimensions?: MetricsDimensions
): void => {
  fireAndForget({
    name: 'presence_anomaly_evaluations_total',
    value: 1,
    dimensions
  });
};

export const recordPresenceAnomalyRatio = (
  ratio: number,
  dimensions?: MetricsDimensions
): void => {
  fireAndForget({
    name: 'presence_anomaly_ratio',
    value: ratio,
    dimensions
  });
};

export const recordPresenceCapEvent = (dimensions?: MetricsDimensions): void => {
  fireAndForget({
    name: 'presence_caps_total',
    value: 1,
    dimensions
  });
};

export const recordPresenceUpdateLatency = (
  latencyMs: number,
  dimensions?: MetricsDimensions
): void => {
  fireAndForget({
    name: 'presence_update_latency_ms',
    value: latencyMs,
    dimensions
  });
};

export const recordPresenceBatchDuration = (
  durationMs: number,
  dimensions?: MetricsDimensions
): void => {
  fireAndForget({
    name: 'presence_batch_process_duration_ms',
    value: durationMs,
    dimensions
  });
};

export const recordPresenceIncrementsPerTick = (
  count: number,
  dimensions?: MetricsDimensions
): void => {
  fireAndForget({
    name: 'presence_increments_per_tick',
    value: count,
    dimensions
  });
};

export const recordActivePresenceTiles = (count: number): void => {
  fireAndForget({
    name: 'presence_active_tiles',
    value: count
  });
};

export const recordCappedPresenceTiles = (count: number): void => {
  fireAndForget({
    name: 'presence_capped_tiles',
    value: count
  });
};

export const recordHexesExploredPerSession = (
  count: number,
  dimensions?: MetricsDimensions
): void => {
  fireAndForget({
    name: 'hexes_explored_per_session',
    value: count,
    dimensions
  });
};

export const recordWorldBoundaryRejection = (
  reason: WorldBoundaryRejectionReason,
  dimensions?: MetricsDimensions
): void => {
  fireAndForget({
    name: 'world_boundary_move_rejections_total',
    value: 1,
    dimensions: { reason, ...(dimensions ?? {}) }
  });
};
