import {
  presenceBundledUpdateMessageSchema,
  presenceUpdateMessageSchema,
  type PresenceUpdatePayload
} from '@hexmud/protocol';
import type { Room } from 'colyseus.js';
import { useEffect, useState } from 'react';

import {
  recordPresenceLatencySample,
  type PresenceLatencyMessageType
} from '../../services/latency/presenceLatencyTracker.js';

const recordLatencySample = (
  updates: PresenceUpdatePayload[],
  messageType: PresenceLatencyMessageType
): void => {
  if (updates.length === 0) {
    return;
  }

  const observedAt = Date.now();
  let minLatency = Number.POSITIVE_INFINITY;
  let maxLatency = 0;
  let totalLatency = 0;

  for (const entry of updates) {
    const latency = Math.max(0, observedAt - entry.ts);
    totalLatency += latency;
    if (latency < minLatency) {
      minLatency = latency;
    }
    if (latency > maxLatency) {
      maxLatency = latency;
    }
  }

  const averageLatency = totalLatency / updates.length;

  recordPresenceLatencySample({
    batchSize: updates.length,
    averageLatencyMs: averageLatency,
    minLatencyMs: Number.isFinite(minLatency) ? minLatency : 0,
    maxLatencyMs: maxLatency,
    observedAt,
    messageType
  });
};

const detachListener = (
  room: Room<unknown>,
  handler: (message: unknown) => void
): void => {
  const candidate = room as unknown as {
    removeListener?: (type: string, cb: (message: unknown) => void) => void;
    off?: (type: string, cb: (message: unknown) => void) => void;
  };
  if (typeof candidate.removeListener === 'function') {
    candidate.removeListener('envelope', handler);
  } else if (typeof candidate.off === 'function') {
    candidate.off('envelope', handler);
  }
};

export interface PresenceUpdatesHookResult {
  lastUpdateTs?: number;
}

export interface PresenceUpdatesHookOptions {
  applyUpdate: (update: PresenceUpdatePayload) => void;
  onDecay?: (update: PresenceUpdatePayload) => void;
}

export const usePresenceUpdates = (
  room: Room<unknown> | undefined,
  options: PresenceUpdatesHookOptions
): PresenceUpdatesHookResult => {
  const { applyUpdate, onDecay } = options;
  const [lastUpdateTs, setLastUpdateTs] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!room) {
      setLastUpdateTs(undefined);
      return;
    }

    const handleEnvelope = (raw: unknown) => {
      const singleResult = presenceUpdateMessageSchema.safeParse(raw);
      if (singleResult.success) {
        const update = singleResult.data.payload;
        applyUpdate(update);
        if (update.reason === 'decay') {
          onDecay?.(update);
        }
        setLastUpdateTs(update.ts);
        recordLatencySample([update], 'single');
        return;
      }

      const bundledResult = presenceBundledUpdateMessageSchema.safeParse(raw);
      if (bundledResult.success) {
        const { entries } = bundledResult.data.payload;
        for (const entry of entries) {
          applyUpdate(entry);
          if (entry.reason === 'decay') {
            onDecay?.(entry);
          }
        }
        setLastUpdateTs(bundledResult.data.payload.ts);
        recordLatencySample(entries, 'bundled');
      }
    };

    room.onMessage('envelope', handleEnvelope);

    return () => {
      detachListener(room, handleEnvelope);
    };
  }, [room, applyUpdate, onDecay]);

  return { lastUpdateTs };
};
