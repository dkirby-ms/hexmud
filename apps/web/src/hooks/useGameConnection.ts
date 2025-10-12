import {
  envelopeSchema,
  errorPayloadSchema,
  heartbeatPayloadSchema,
  sessionWelcomePayloadSchema
} from '@hexmud/protocol';
import { useEffect, useMemo, useRef, useState } from 'react';

import { connectToPlaceholderWorld, sendHeartbeat } from '../protocol/placeholderClient.js';

import { useAuth } from './useAuth.js';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface GameConnectionState {
  status: ConnectionStatus;
  sessionId?: string;
  playerId?: string;
  buildNumber?: number;
  latencyMs?: number;
  roomMessage?: string;
  error?: string;
}

const parseHeartbeatInterval = (): number => {
  const env = import.meta.env as Record<string, string | undefined>;
  const rawValue = env.VITE_HEARTBEAT_INTERVAL_MS;
  const raw = typeof rawValue === 'string' ? rawValue : '';
  const candidate = Number.parseInt(raw, 10);

  return Number.isFinite(candidate) && candidate > 0 ? candidate : 5_000;
};

export const useGameConnection = (): GameConnectionState => {
  const [state, setState] = useState<GameConnectionState>({ status: 'idle' });
  const heartbeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingHeartbeatAt = useRef<number | null>(null);
  const connectionRef = useRef<Awaited<ReturnType<typeof connectToPlaceholderWorld>> | null>(null);
  const isMounted = useRef(true);
  const roomMessageRef = useRef<string>('Awaiting world state...');
  const auth = useAuth();
  const authAttemptedRef = useRef(false);
  const authStatus = auth.status;
  const authAccessToken = auth.accessToken;
  const authError = auth.error;
  const ensureAuthToken = auth.ensureAccessToken;

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;

      if (heartbeatTimer.current) {
        clearInterval(heartbeatTimer.current);
        heartbeatTimer.current = null;
      }

      const connection = connectionRef.current;
      connectionRef.current = null;
      if (connection) {
        connection.disconnect().catch((error) => {
          if (import.meta.env.DEV) {
            console.warn('Failed to disconnect placeholder connection cleanly', error);
          }
        });
      }
    };
  }, []);

  useEffect(() => {
    if (authStatus === 'error' && authError && isMounted.current) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: authError
      }));
      return;
    }

    if (authStatus === 'unauthenticated' && !authAttemptedRef.current) {
      authAttemptedRef.current = true;
      void ensureAuthToken().catch((error) => {
        if (!isMounted.current) {
          return;
        }
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: error instanceof Error ? error.message : 'Authentication required'
        }));
      });
    }

    if (authStatus === 'authenticated') {
      authAttemptedRef.current = false;
    }

    const shouldConnect =
      authStatus === 'disabled' || authStatus === 'authenticated';

    if (!shouldConnect) {
      return;
    }

    if (connectionRef.current) {
      return;
    }

    const connect = async () => {
      setState((prev) => ({ ...prev, status: 'connecting', error: undefined }));

      let accessToken: string | undefined;
      if (authStatus === 'authenticated') {
        try {
          const ensuredToken = await ensureAuthToken();
          const token = ensuredToken ?? authAccessToken;
          if (!token) {
            throw new Error('Authentication required');
          }
          accessToken = token;
        } catch (error) {
          if (isMounted.current) {
            setState({
              status: 'error',
              error: error instanceof Error ? error.message : 'Authentication required'
            });
          }
          return;
        }
      }

      try {
        const connection = await connectToPlaceholderWorld(accessToken);
        if (!isMounted.current) {
          await connection.disconnect();
          return;
        }

        connectionRef.current = connection;
        const { room } = connection;

        room.onMessage('envelope', (raw) => {
          if (!isMounted.current) {
            return;
          }
          try {
            const envelope = envelopeSchema.parse(raw);

            switch (envelope.type) {
              case 'session.welcome': {
                const payload = sessionWelcomePayloadSchema.parse(envelope.payload);
                setState((prev) => ({
                  ...prev,
                  status: 'connected',
                  sessionId: payload.sessionId,
                  playerId: payload.playerId,
                  buildNumber: payload.build,
                  error: undefined
                }));
                break;
              }
              case 'room.state': {
                const payload = envelope.payload as {
                  snapshot?: { message?: unknown };
                };
                const snapshotMessage =
                  typeof payload?.snapshot?.message === 'string'
                    ? payload.snapshot.message
                    : roomMessageRef.current;
                roomMessageRef.current = snapshotMessage;
                setState((prev) => ({
                  ...prev,
                  roomMessage: snapshotMessage
                }));
                break;
              }
              case 'heartbeat': {
                heartbeatPayloadSchema.parse(envelope.payload);
                if (pendingHeartbeatAt.current) {
                  const latency = Date.now() - pendingHeartbeatAt.current;
                  setState((prev) => ({
                    ...prev,
                    latencyMs: latency
                  }));
                  pendingHeartbeatAt.current = null;
                }
                break;
              }
              case 'error': {
                const payload = errorPayloadSchema.parse(envelope.payload);
                setState((prev) => ({
                  ...prev,
                  status: 'error',
                  error: payload.message
                }));
                break;
              }
              default: {
                if (import.meta.env.DEV) {
                  console.warn('Unhandled envelope type', envelope.type);
                }
              }
            }
          } catch (error) {
            if (import.meta.env.DEV) {
              console.warn('Failed to parse envelope', error);
            }
          }
        });

        room.onLeave((code) => {
          if (!isMounted.current) {
            return;
          }
          if (code !== 1000) {
            setState((prev) => ({
              ...prev,
              status: 'error',
              error: `Disconnected (${code})`
            }));
          }
        });

        const interval = parseHeartbeatInterval();
        heartbeatTimer.current = setInterval(() => {
          if (!isMounted.current || !connectionRef.current) {
            return;
          }
          pendingHeartbeatAt.current = Date.now();
          sendHeartbeat(connectionRef.current.room);
        }, interval);

        pendingHeartbeatAt.current = Date.now();
        sendHeartbeat(room);
      } catch (error) {
        if (!isMounted.current) {
          return;
        }
        setState({
          status: 'error',
          error: error instanceof Error ? error.message : 'Unable to connect to the game world'
        });
      }
    };

    void connect();
  }, [authStatus, authAccessToken, authError, ensureAuthToken]);

  return useMemo(() => state, [state]);
};
