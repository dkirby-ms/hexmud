import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'colyseus.js';
import WebSocket from 'ws';

import { PROTOCOL_VERSION } from '@hexmud/protocol';

import {
  createAuthenticatedTestContext,
  type AuthenticatedTestContext
} from '../helpers/auth.js';

(globalThis as typeof globalThis & { WebSocket?: typeof WebSocket }).WebSocket = WebSocket as never;

describe('authenticated join flow', () => {
  let cleanup: (() => Promise<void>) | null = null;
  let authContext: AuthenticatedTestContext | null = null;
  let sessionsStore: typeof import('../../src/state/sessions.js')['sessions'];
  let serverPort: number | null = null;

  beforeAll(async () => {
    authContext = await createAuthenticatedTestContext();
    sessionsStore = (await import('../../src/state/sessions.js')).sessions;
    const { stop, httpServer } = await authContext.startServer();

    const address = httpServer.address() as AddressInfo | string | null;
    serverPort = typeof address === 'object' && address ? address.port : Number(process.env.SERVER_PORT ?? '2567');

    cleanup = async () => {
      await stop();
      await authContext?.teardown();
    };
  });

  afterAll(async () => {
    if (cleanup) {
      await cleanup();
    } else if (authContext) {
      await authContext.teardown();
    }
  });

  it('accepts a valid token and records the authenticated identity', async () => {
    const expectedPlayerId = 'player-authenticated';
    const expectedDisplayName = 'Authenticated Adventurer';

    const accessToken = await authContext!.issueToken({
      oid: expectedPlayerId,
      name: expectedDisplayName,
      preferred_username: 'adventurer@example.com'
    });

    const port = serverPort ?? Number(process.env.SERVER_PORT ?? '2567');
    const client = new Client(`ws://127.0.0.1:${port}`);

    const room = await client.joinOrCreate('placeholder', {
      protocolVersion: PROTOCOL_VERSION,
      accessToken
    });

    expect(room.sessionId).toBeTruthy();

    const identity = sessionsStore.getIdentity(expectedPlayerId);
    expect(identity).toBeTruthy();
    expect(identity?.displayName).toBe(expectedDisplayName);
    expect(identity?.roles).toContain('player');
    expect(identity?.authClaims).toMatchObject({
      oid: expectedPlayerId,
      preferred_username: 'adventurer@example.com'
    });

    const session = sessionsStore.getSession(room.sessionId);
    expect(session?.playerId).toBe(expectedPlayerId);

    await new Promise<void>((resolve) => {
      room.leave(true);
      room.onLeave(() => resolve());
    });
  });

  it('rejects join requests without an access token when auth is enabled', async () => {
    const port = serverPort ?? Number(process.env.SERVER_PORT ?? '2567');
    const client = new Client(`ws://127.0.0.1:${port}`);
    const activeBefore = sessionsStore.listActiveSessions().length;

    await expect(
      client.joinOrCreate('placeholder', {
        protocolVersion: PROTOCOL_VERSION
      })
    ).rejects.toThrow(/AUTH_REQUIRED/);

    // Ensure no session records were created
    expect(sessionsStore.listActiveSessions().length).toBe(activeBefore);
  });

  it('accepts an access token with a not-before slightly in the future', async () => {
    const futureNbf = Math.floor(Date.now() / 1000) + 30;
    const accessToken = await authContext!.issueToken({
      nbf: futureNbf
    });

    const port = serverPort ?? Number(process.env.SERVER_PORT ?? '2567');
    const client = new Client(`ws://127.0.0.1:${port}`);

    const room = await client.joinOrCreate('placeholder', {
      protocolVersion: PROTOCOL_VERSION,
      accessToken
    });

    expect(room.sessionId).toBeTruthy();

    await new Promise<void>((resolve) => {
      room.leave(true);
      room.onLeave(() => resolve());
    });
  });

  it('rejects tokens with invalid signatures and does not create a session', async () => {
    const validToken = await authContext!.issueToken();
    const tamperedToken = `${validToken.slice(0, -1)}x`;

    const port = serverPort ?? Number(process.env.SERVER_PORT ?? '2567');
    const client = new Client(`ws://127.0.0.1:${port}`);
    const activeBefore = sessionsStore.listActiveSessions().length;

    await expect(
      client.joinOrCreate('placeholder', {
        protocolVersion: PROTOCOL_VERSION,
        accessToken: tamperedToken
      })
    ).rejects.toThrow(/AUTH_REQUIRED/);

    expect(sessionsStore.listActiveSessions().length).toBe(activeBefore);
  });

  it('records moderator role from token claims into the session identity', async () => {
    const expectedPlayerId = 'moderator-player';
    const accessToken = await authContext!.issueToken({
      oid: expectedPlayerId,
      name: 'Moderator Example',
      roles: ['moderator']
    });

    const port = serverPort ?? Number(process.env.SERVER_PORT ?? '2567');
    const client = new Client(`ws://127.0.0.1:${port}`);

    const room = await client.joinOrCreate('placeholder', {
      protocolVersion: PROTOCOL_VERSION,
      accessToken
    });

    const identity = sessionsStore.getIdentity(expectedPlayerId);
    expect(identity).toBeTruthy();
    expect(identity?.roles).toEqual(expect.arrayContaining(['player', 'moderator']));
    expect(identity?.authClaims.roles).toContain('moderator');

    await new Promise<void>((resolve) => {
      room.leave(true);
      room.onLeave(() => resolve());
    });
  });
});
