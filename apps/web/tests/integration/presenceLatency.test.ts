import { act, renderHook } from '@testing-library/react';
import type { Room } from 'colyseus.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createEnvelope } from '@hexmud/protocol';

import { usePresenceUpdates } from '../../src/components/HexMap/usePresenceUpdates.js';
import {
  observePresenceLatency,
  PresenceLatencySample,
  resetPresenceLatencyTracker
} from '../../src/services/latency/presenceLatencyTracker.js';

class MockRoom {
  private readonly listeners = new Map<string, Set<(message: unknown) => void>>();

  onMessage(type: string, handler: (message: unknown) => void): void {
    const set = this.listeners.get(type) ?? new Set();
    set.add(handler);
    this.listeners.set(type, set);
  }

  removeListener(type: string, handler: (message: unknown) => void): void {
    const set = this.listeners.get(type);
    if (!set) {
      return;
    }
    set.delete(handler);
    if (set.size === 0) {
      this.listeners.delete(type);
    }
  }

  off(type: string, handler: (message: unknown) => void): void {
    this.removeListener(type, handler);
  }

  emit(type: string, message: unknown): void {
    const set = this.listeners.get(type);
    if (!set) {
      return;
    }
    for (const handler of set) {
      handler(message);
    }
  }
}

describe('presence latency measurement', () => {
  beforeEach(() => {
    resetPresenceLatencyTracker();
    vi.useFakeTimers({
      toFake: ['Date']
    });
    vi.setSystemTime(new Date('2025-10-18T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    resetPresenceLatencyTracker();
  });

  it('records latency for single presence update messages', () => {
    const room = new MockRoom();
    const applyUpdate = vi.fn();
  const samples: PresenceLatencySample[] = [];
  const stop = observePresenceLatency((sample: PresenceLatencySample) => {
      samples.push(sample);
    });

    const { unmount } = renderHook(() =>
      usePresenceUpdates(room as unknown as Room<unknown>, {
        applyUpdate
      })
    );

    const messageTs = Date.now() - 150;

    act(() => {
      room.emit(
        'envelope',
        createEnvelope('presence:update', {
          hexId: 'hex:5:7',
          delta: 1,
          newValue: 12,
          reason: 'increment',
          tierAfter: 2,
          ts: messageTs
        })
      );
    });

    expect(applyUpdate).toHaveBeenCalledTimes(1);
    expect(samples).toHaveLength(1);
    expect(samples[0]?.batchSize).toBe(1);
    expect(samples[0]?.averageLatencyMs).toBe(150);
    expect(samples[0]?.minLatencyMs).toBe(150);
    expect(samples[0]?.maxLatencyMs).toBe(150);

    stop();
    unmount();
  });

  it('records latency aggregates for bundled update messages', () => {
    const room = new MockRoom();
    const applyUpdate = vi.fn();
  const samples: PresenceLatencySample[] = [];
  const stop = observePresenceLatency((sample: PresenceLatencySample) => {
      samples.push(sample);
    });

    renderHook(() =>
      usePresenceUpdates(room as unknown as Room<unknown>, {
        applyUpdate
      })
    );

    const base = Date.now();
    const firstUpdateTs = base - 200;
    const secondUpdateTs = base - 80;

    act(() => {
      room.emit(
        'envelope',
        createEnvelope('presence:update.bundled', {
          ts: base - 60,
          entries: [
            {
              hexId: 'hex:2:4',
              delta: 2,
              newValue: 7,
              reason: 'increment',
              tierAfter: 2,
              ts: firstUpdateTs
            },
            {
              hexId: 'hex:2:5',
              delta: -1,
              newValue: 3,
              reason: 'decay',
              tierAfter: 1,
              ts: secondUpdateTs
            }
          ]
        })
      );
    });

    expect(applyUpdate).toHaveBeenCalledTimes(2);
    expect(samples).toHaveLength(1);
    const [sample] = samples;
    expect(sample?.batchSize).toBe(2);
    expect(sample?.minLatencyMs).toBe(80);
    expect(sample?.maxLatencyMs).toBe(200);
    expect(sample?.averageLatencyMs).toBe((200 + 80) / 2);

    stop();
  });
});
