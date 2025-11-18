import type { FC } from 'react';
import { useCallback } from 'react';

import { useAuth } from '../hooks/useAuth.js';
import { useGameConnection } from '../hooks/useGameConnection.js';

const formatLatency = (latencyMs?: number) =>
  typeof latencyMs === 'number' ? `${latencyMs.toFixed(0)} ms` : '—';

export const WorldPlaceholder: FC = () => {
  const { status, playerId, sessionId, buildNumber, roomMessage, latencyMs, error } =
    useGameConnection();
  const {
    status: authStatus,
    account,
    error: authError,
    errorCode,
    signInRedirect,
    signIn,
    signOut
  } = useAuth();

  const handleRedirectSignIn = useCallback(() => {
    void signInRedirect();
  }, [signInRedirect]);

  const handlePopupFallback = useCallback(() => {
    void signIn();
  }, [signIn]);

  const handleSignOut = useCallback(() => {
    void signOut();
  }, [signOut]);

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

  const authStatusLabel = (() => {
    switch (authStatus) {
      case 'authenticated':
        return 'Signed in';
      case 'unauthenticated':
        return 'Sign in required';
      case 'loading':
        return 'Checking authentication…';
      case 'disabled':
        return 'Authentication disabled';
      case 'error':
      default:
        return 'Authentication error';
    }
  })();

  const accountLabel = account?.username ?? account?.name ?? 'Guest';

  return (
    <section aria-live="polite" aria-busy={status !== 'connected'}>
      <h2>World Status</h2>
      <p>{statusLabel}</p>

      <section aria-live="polite" aria-busy={authStatus === 'loading'}>
        <h3>Authentication</h3>
        <p>{authStatusLabel}</p>

        {authStatus === 'authenticated' && (
          <div>
            <p>
              Signed in as <strong>{accountLabel}</strong>
            </p>
            <button type="button" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        )}

        {authStatus === 'unauthenticated' && (
          <div>
            <button type="button" onClick={handleRedirectSignIn}>
              Sign in (redirect)
            </button>
            <button type="button" onClick={handlePopupFallback}>
              Use popup fallback
            </button>
          </div>
        )}

        {authError && authStatus === 'error' && <p role="alert">{authError}</p>}
        {errorCode === 'user_cancelled' && (
          <p role="status">Sign-in cancelled. You can resume when you&apos;re ready.</p>
        )}
      </section>

      {status === 'connected' && (
        <dl>
          <div>
            <dt>Authenticated player ID</dt>
            <dd>{playerId ?? 'Unknown explorer'}</dd>
          </div>
          <div>
            <dt>Account</dt>
            <dd>{authStatus === 'authenticated' ? accountLabel : 'Not signed in'}</dd>
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
