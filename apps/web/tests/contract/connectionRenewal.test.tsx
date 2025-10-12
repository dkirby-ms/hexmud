import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { UseAuthResult } from '../../src/hooks/useAuth.js';
import { WorldPlaceholder } from '../../src/components/WorldPlaceholder';

interface MockConnection {
  room: {
    onMessage: (type: string, handler: (payload: unknown) => void) => void;
    onLeave: (handler: (code: number) => void) => void;
    leave: () => void;
    send: () => void;
  };
  disconnect: () => Promise<void>;
  __handlers: Record<string, (payload: any) => void>;
}

const connectToPlaceholderWorld = vi.fn<
  (...args: [string | undefined]) => Promise<MockConnection>
>();
const sendHeartbeat = vi.fn();

vi.mock('../../src/protocol/placeholderClient', () => ({
  connectToPlaceholderWorld: (...args: Parameters<typeof connectToPlaceholderWorld>) =>
    connectToPlaceholderWorld(...args),
  sendHeartbeat: (...args: Parameters<typeof sendHeartbeat>) => sendHeartbeat(...args)
}));

const ensureAccessToken = vi.fn<() => Promise<string | null>>();
const signIn = vi.fn(async () => ({ success: true, accessToken: 'fresh-token' }));
const signInRedirect = vi.fn(async () => {});
const signOut = vi.fn(async () => {
  authState.status = 'unauthenticated';
  authState.accessToken = null;
});
const refresh = vi.fn(async () => 'fresh-token');

const authState: UseAuthResult = {
  status: 'authenticated',
  account: {
    username: 'player@example.com',
    name: 'Player Example',
    homeAccountId: 'home',
    localAccountId: 'local',
    tenantId: 'tenant',
    environment: 'login'
  },
  accessToken: 'initial-token',
  error: undefined,
  errorCode: null,
  signIn,
  signInRedirect,
  signOut,
  refresh,
  ensureAccessToken
};

type UseAuthMock = () => UseAuthResult;

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: (() => authState) as UseAuthMock
}));

const createConnection = (): MockConnection => {
  const handlers: Record<string, (payload: unknown) => void> = {};
  return {
    room: {
      onMessage: (type: string, handler: (payload: unknown) => void) => {
        handlers[type] = handler;
      },
      onLeave: () => {},
      leave: () => {},
      send: () => {}
    },
    disconnect: async () => {},
    __handlers: handlers
  };
};

describe('connection renewal behaviour', () => {
  let view: ReturnType<typeof render> | null = null;

  const renderComponent = (): ReactElement => <WorldPlaceholder />;

  beforeEach(() => {
    vi.clearAllMocks();
    authState.status = 'authenticated';
    authState.accessToken = 'initial-token';
    ensureAccessToken.mockReset();
    ensureAccessToken.mockResolvedValue('initial-token');
    signOut.mockClear();
    connectToPlaceholderWorld.mockReset();
    sendHeartbeat.mockReset();
  });

  afterEach(() => {
    if (view) {
      view.unmount();
      view = null;
    }
  });

  it('renews token and reconnects after unauthorized error', async () => {
    const firstConnection = createConnection();
    const secondConnection = createConnection();

    connectToPlaceholderWorld.mockResolvedValueOnce(firstConnection);
    connectToPlaceholderWorld.mockResolvedValueOnce(secondConnection);

    ensureAccessToken.mockResolvedValueOnce('stale-token');
    ensureAccessToken.mockResolvedValueOnce('fresh-token');

    authState.accessToken = 'stale-token';

    view = render(renderComponent());

    await waitFor(() => {
      expect(connectToPlaceholderWorld).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      firstConnection.__handlers['envelope']?.({
        type: 'error',
        v: 1,
        ts: Date.now(),
        payload: {
          code: 'AUTH_REQUIRED',
          message: 'AUTH_REQUIRED: access token has expired'
        }
      });
    });

    await waitFor(() => {
      expect(connectToPlaceholderWorld).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      secondConnection.__handlers['envelope']?.({
        type: 'session.welcome',
        v: 1,
        ts: Date.now(),
        payload: {
          sessionId: 'session-2',
          playerId: 'player-2',
          protocolVersion: 1,
          build: 99
        }
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/connected to the game world/i)).toBeInTheDocument();
    });

    expect(connectToPlaceholderWorld).toHaveBeenNthCalledWith(1, 'stale-token');
    expect(connectToPlaceholderWorld).toHaveBeenNthCalledWith(2, 'fresh-token');
  });

  it('remains disconnected after sign-out until re-authenticated', async () => {
    const initialConnection = createConnection();
    const renewedConnection = createConnection();

    connectToPlaceholderWorld.mockResolvedValueOnce(initialConnection);
    connectToPlaceholderWorld.mockResolvedValueOnce(renewedConnection);

    ensureAccessToken.mockResolvedValueOnce('initial-token');

    view = render(renderComponent());

    await waitFor(() => {
      expect(connectToPlaceholderWorld).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      initialConnection.__handlers['envelope']?.({
        type: 'session.welcome',
        v: 1,
        ts: Date.now(),
        payload: {
          sessionId: 'session-1',
          playerId: 'player-1',
          protocolVersion: 1,
          build: 101
        }
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/connected to the game world/i)).toBeInTheDocument();
    });

    ensureAccessToken.mockRejectedValueOnce(new Error('Authentication required'));

    const signOutButton = await screen.findByRole('button', { name: /sign out/i });

    await act(async () => {
      fireEvent.click(signOutButton);
    });

    view.rerender(renderComponent());

    await waitFor(() => {
      expect(screen.getByText(/sign in required/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/connection error: authentication required/i)).toBeInTheDocument();
    });

    authState.status = 'authenticated';
    authState.accessToken = 'renewed-token';
    ensureAccessToken.mockResolvedValueOnce('renewed-token');

    view.rerender(renderComponent());

    await waitFor(() => {
      expect(connectToPlaceholderWorld).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      renewedConnection.__handlers['envelope']?.({
        type: 'session.welcome',
        v: 1,
        ts: Date.now(),
        payload: {
          sessionId: 'session-3',
          playerId: 'player-3',
          protocolVersion: 1,
          build: 202
        }
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/connected to the game world/i)).toBeInTheDocument();
    });
  });
});
