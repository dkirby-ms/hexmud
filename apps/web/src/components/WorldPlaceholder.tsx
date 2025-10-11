import type { FC } from 'react';

import { useGameConnection } from '../hooks/useGameConnection.js';

const formatLatency = (latencyMs?: number) =>
  typeof latencyMs === 'number' ? `${latencyMs.toFixed(0)} ms` : '—';

export const WorldPlaceholder: FC = () => {
  const { status, playerId, sessionId, buildNumber, roomMessage, latencyMs, error } =
    useGameConnection();

  const statusLabel = (() => {
    switch (status) {
      case 'connected':
        return 'Connected to the game world';
      case 'error':
        return error ? `Connection error: ${error}` : 'Connection error';
      case 'connecting':
      case 'idle':
      default:
        return 'Connecting to the game world…';
    }
  })();

  return (
    <section aria-live="polite" aria-busy={status !== 'connected'}>
      <h2>World Status</h2>
      <p>{statusLabel}</p>

      {status === 'connected' && (
        <dl>
          <div>
            <dt>Authenticated player ID</dt>
            <dd>{playerId ?? 'Unknown explorer'}</dd>
          </div>
          <div>
            <dt>Session</dt>
            <dd>{sessionId}</dd>
          </div>
          <div>
            <dt>Server build</dt>
            <dd>{typeof buildNumber === 'number' ? buildNumber : '—'}</dd>
          </div>
          <div>
            <dt>Heartbeat latency</dt>
            <dd>{formatLatency(latencyMs)}</dd>
          </div>
        </dl>
      )}

      {roomMessage && <p>{roomMessage}</p>}
    </section>
  );
};
