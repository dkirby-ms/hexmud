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

describe('protocol version guard', () => {
  let cleanup: (() => Promise<void>) | null = null;
  let authContext: AuthenticatedTestContext | null = null;
  let serverPort: number | null = null;

  beforeAll(async () => {
    authContext = await createAuthenticatedTestContext();
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

  it('rejects a client that advertises a mismatched protocol version', async () => {
  const port = serverPort ?? Number(process.env.SERVER_PORT ?? '2567');
  const client = new Client(`ws://127.0.0.1:${port}`);
    const accessToken = await authContext!.issueToken({
      oid: 'player-version-mismatch',
      name: 'Version Checker'
    });

    await expect(async () => {
      try {
        await client.joinOrCreate('placeholder', {
          protocolVersion: PROTOCOL_VERSION + 1,
          accessToken
        });
      } finally {
        const connection = (client as unknown as { connection?: WebSocket }).connection;
        connection?.close?.();
      }
    }).rejects.toThrow(/VERSION_MISMATCH/i);
  });
});
