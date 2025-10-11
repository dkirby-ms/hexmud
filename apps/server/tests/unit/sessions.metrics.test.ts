import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MetricsEvent } from '../../src/metrics/adapter.js';
import type { PlayerSession } from '../../src/state/sessions.js';

describe('session metrics instrumentation', () => {
  let events: MetricsEvent[];
  let setMetricsAdapter: typeof import('../../src/metrics/adapter.js')['setMetricsAdapter'];
  let sessions: typeof import('../../src/state/sessions.js')['sessions'];

  const installMetricsSpy = () => {
    setMetricsAdapter({
      emit: async (event) => {
        events.push(event);
      }
    });
  };

  const resetMetricsAdapter = () => {
    setMetricsAdapter({
      emit: async () => {
        // noop reset
      }
    });
  };

  const createBaseSession = (overrides: Partial<PlayerSession> = {}): PlayerSession => ({
    sessionId: 'session-1',
    playerId: 'player-1',
    connectedAt: new Date(),
    lastHeartbeatAt: new Date(),
    connectionState: 'active' as const,
    protocolVersion: 1,
    roomId: 'placeholder',
    ...overrides
  });

  beforeEach(async () => {
    vi.resetModules();
    events = [];

    ({ setMetricsAdapter } = await import('../../src/metrics/adapter.js'));
    installMetricsSpy();

    ({ sessions } = await import('../../src/state/sessions.js'));
  });

  afterEach(() => {
    resetMetricsAdapter();
  });

  it('emits total and active session metrics when an active session is created', () => {
    sessions.createSession(createBaseSession());

    expect(events).toHaveLength(2);

  const [total, active] = events as [MetricsEvent, MetricsEvent];
    expect(total.name).toBe('sessions_total');
    expect(total.value).toBe(1);
    expect(total.dimensions).toEqual({
      playerId: 'player-1',
      roomId: 'placeholder'
    });
    expect(typeof total.timestamp).toBe('number');

    expect(active.name).toBe('sessions_active');
    expect(active.value).toBe(1);
    expect(typeof active.timestamp).toBe('number');
  });

  it('updates active session gauge when connection state changes', () => {
    sessions.createSession(
      createBaseSession({
        sessionId: 'session-joining',
        connectionState: 'joining'
      })
    );

    expect(events).toHaveLength(1);
    expect(events[0]?.name).toBe('sessions_total');

    events.length = 0;

    sessions.updateSession('session-joining', { connectionState: 'active' });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      name: 'sessions_active',
      value: 1
    });

    events.length = 0;

    sessions.updateSession('session-joining', { connectionState: 'closing' });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      name: 'sessions_active',
      value: 0
    });
  });

  it('emits active session gauge when a session is removed', () => {
    sessions.createSession(createBaseSession());
    events.length = 0;

    sessions.removeSession('session-1');

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      name: 'sessions_active',
      value: 0
    });
  });
});
