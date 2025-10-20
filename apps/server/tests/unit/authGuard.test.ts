import type { Client } from 'colyseus';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { PROTOCOL_VERSION } from '@hexmud/protocol';

const validateAccessTokenMock = vi.fn();

class MockAccessTokenValidationError extends Error {
  reason: string;

  constructor(reason: string, message?: string) {
    super(message);
    this.name = 'AccessTokenValidationError';
    this.reason = reason;
  }
}

describe('join authentication guard', () => {
  let processJoinRequest: typeof import('../../src/handlers/join.js')['processJoinRequest'];
  let JoinRejectedError: typeof import('../../src/handlers/join.js')['JoinRejectedError'];

  beforeAll(() => {
    process.env.MSAL_API_AUDIENCE = 'test-api-client-id';
    process.env.MSAL_REQUIRED_SCOPE = 'api://test-api-client-id/GameService.Access';
    process.env.MSAL_AUTHORITY = 'https://login.microsoftonline.com/test-tenant/v2.0';
    process.env.MSAL_JWKS_URI = 'https://example.com/discovery/v2.0/keys';
  });

  afterEach(() => {
    vi.unmock('../../src/auth/validateToken.js');
  });

  beforeEach(async () => {
    vi.unmock('../../src/auth/validateToken.js');
    validateAccessTokenMock.mockReset();
    vi.resetModules();
    vi.doMock('../../src/auth/validateToken.js', () => ({
      validateAccessToken: validateAccessTokenMock,
      AccessTokenValidationError: MockAccessTokenValidationError
    }));
    const module = await import('../../src/handlers/join.js');
    processJoinRequest = module.processJoinRequest;
    JoinRejectedError = module.JoinRejectedError;
  });

  afterAll(() => {
    delete process.env.MSAL_API_AUDIENCE;
    delete process.env.MSAL_REQUIRED_SCOPE;
    delete process.env.MSAL_AUTHORITY;
    delete process.env.MSAL_JWKS_URI;
  });

  it('rejects when access token is missing', async () => {
    const send = vi.fn();
    const client = { sessionId: 'session-auth-missing', send } as unknown as Client;

    await expect(
      processJoinRequest({
        client,
        options: { protocolVersion: PROTOCOL_VERSION },
        expectedProtocolVersion: PROTOCOL_VERSION
      })
    ).rejects.toBeInstanceOf(JoinRejectedError);

    expect(send).toHaveBeenCalledTimes(1);
  const call = send.mock.calls[0]!;
  const [, envelope] = call;
    expect(envelope.payload.code).toBe('AUTH_REQUIRED');
    expect(validateAccessTokenMock).not.toHaveBeenCalled();
  });
});
