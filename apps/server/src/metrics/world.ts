import type { WorldLoadFailureReason, WorldLoadPhase } from '../logging/events.js';
import { metrics } from './adapter.js';
import type { MetricsEvent } from './adapter.js';

const fireAndForget = (event: MetricsEvent): void => {
  void metrics.emit(event).catch(() => {
    // Suppress metric emission failures to avoid impacting gameplay flow.
  });
};

interface WorldLoadSuccessMetrics {
  worldKey: string;
  durationMs: number;
  validationDurationMs: number;
  regionCount: number;
  tileCount: number;
  spawnRegionCount: number;
}

interface WorldLoadFailureMetrics {
  worldKey: string;
  reason: WorldLoadFailureReason;
  durationMs: number;
  phase: WorldLoadPhase;
  validationErrorCount?: number;
}

interface WorldValidationErrorMetrics {
  worldKey: string;
  errorCount: number;
  durationMs: number;
}

export const recordWorldLoadSuccess = ({
  worldKey,
  durationMs,
  validationDurationMs,
  regionCount,
  tileCount,
  spawnRegionCount
}: WorldLoadSuccessMetrics): void => {
  fireAndForget({
    name: 'world_load_success_total',
    value: 1,
    dimensions: { worldKey }
  });

  fireAndForget({
    name: 'world_load_duration_ms',
    value: durationMs,
    dimensions: { worldKey }
  });

  fireAndForget({
    name: 'world_load_validation_duration_ms',
    value: validationDurationMs,
    dimensions: { worldKey }
  });

  fireAndForget({
    name: 'world_regions_loaded',
    value: regionCount,
    dimensions: { worldKey }
  });

  fireAndForget({
    name: 'world_tiles_loaded',
    value: tileCount,
    dimensions: { worldKey }
  });

  fireAndForget({
    name: 'world_spawn_regions_loaded',
    value: spawnRegionCount,
    dimensions: { worldKey }
  });
};

export const recordWorldLoadFailure = ({
  worldKey,
  reason,
  durationMs,
  phase,
  validationErrorCount
}: WorldLoadFailureMetrics): void => {
  fireAndForget({
    name: 'world_load_failure_total',
    value: 1,
    dimensions: {
      worldKey,
      reason,
      phase
    }
  });

  fireAndForget({
    name: 'world_load_failure_duration_ms',
    value: durationMs,
    dimensions: {
      worldKey,
      reason,
      phase
    }
  });

  if (typeof validationErrorCount === 'number') {
    fireAndForget({
      name: 'world_load_validation_error_count',
      value: validationErrorCount,
      dimensions: {
        worldKey,
        reason,
        phase
      }
    });
  }
};

export const recordWorldValidationError = ({
  worldKey,
  errorCount,
  durationMs
}: WorldValidationErrorMetrics): void => {
  fireAndForget({
    name: 'world_validation_errors_total',
    value: errorCount,
    dimensions: { worldKey }
  });

  fireAndForget({
    name: 'world_validation_duration_ms',
    value: durationMs,
    dimensions: { worldKey }
  });
};
