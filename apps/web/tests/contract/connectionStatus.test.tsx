import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorldPlaceholder } from '../../src/components/WorldPlaceholder';

const connectToPlaceholderWorld = vi.fn();
const ensureAccessToken = vi.fn(async () => null);

vi.mock('../../src/protocol/placeholderClient', () => ({
  connectToPlaceholderWorld: (...args: Parameters<typeof connectToPlaceholderWorld>) =>
    connectToPlaceholderWorld(...args)
}));

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({
    status: 'disabled',
    account: null,
    accessToken: null,
    error: undefined,
    signIn: vi.fn(),
    signOut: vi.fn(),
    refresh: vi.fn(async () => null),
    ensureAccessToken
  })
}));

describe('WorldPlaceholder connection status', () => {
  beforeEach(() => {
    const messageHandlers: Record<string, (payload: unknown) => void> = {};

    connectToPlaceholderWorld.mockResolvedValue({
      room: {
        onMessage: (type: string, handler: (payload: unknown) => void) => {
          messageHandlers[type] = handler;
        },
        onLeave: vi.fn(),
        leave: vi.fn(),
        send: vi.fn()
      },
      disconnect: vi.fn(async () => {})
    });

    (connectToPlaceholderWorld as unknown as { __handlers?: Record<string, (payload: unknown) => void> }).__handlers =
      messageHandlers;
  });

  it('shows connected state after receiving welcome message', async () => {
  render(<WorldPlaceholder />);

    expect(screen.getByText(/connecting/i)).toBeInTheDocument();

    const handlers = (connectToPlaceholderWorld as unknown as {
      __handlers: Record<string, (payload: unknown) => void>;
    }).__handlers;

    await act(async () => {
      await Promise.resolve();
      handlers['envelope']?.({
        type: 'session.welcome',
        v: 1,
        ts: Date.now(),
        payload: {
          sessionId: 'session-123',
          playerId: 'player-1',
          protocolVersion: 1,
          build: 42
        }
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/connected to the game world/i)).toBeInTheDocument();
    });

    expect(screen.getByText('Server build')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });
});
