
import { type ErrorCode } from '@hexmud/protocol';
import type { Client } from 'colyseus';

import { type AccessTokenClaims, validateAccessToken } from '../auth/validateToken.js';
import { env } from '../config/env.js';
import type { AuthLogEvent } from '../logging/events.js';
import { logger } from '../logging/logger.js';

import { sendErrorEnvelope } from './error.js';

const logAuthEvent = (event: AuthLogEvent, level: 'info' | 'warn' = 'info') => {
  const { type, ...context } = event;
  logger[level](type, context);
};

export interface JoinOptions {
  playerId?: string;
  protocolVersion?: number;
  accessToken?: string;
}

export interface JoinContext {
  playerId: string;
  protocolVersion: number;
  claims?: AccessTokenClaims;
}

export class JoinRejectedError extends Error {
  constructor(public readonly code: ErrorCode, message: string) {
    super(message);
    this.name = 'JoinRejectedError';
  }
}

interface ProcessJoinRequestParams {
  client: Client;
  options: JoinOptions;
  expectedProtocolVersion: number;
}

const authSettings = (() => {
  const { clientId, authority, jwksUri } = env.msal;
  const enabled = Boolean(clientId && authority && jwksUri);
  return {
    enabled,
    audience: clientId ?? undefined,
    issuer: authority ?? undefined,
    jwksUri: jwksUri ?? undefined
  } as const;
})();

export const processJoinRequest = async ({
  client,
  options,
  expectedProtocolVersion
}: ProcessJoinRequestParams): Promise<JoinContext> => {
  const requestedVersionRaw = options.protocolVersion ?? expectedProtocolVersion;
  const requestedVersion = Number(requestedVersionRaw);

  const reject = (code: ErrorCode, message: string): never => {
    sendErrorEnvelope(client, code, message);
    throw new JoinRejectedError(code, message);
  };

  if (!Number.isFinite(requestedVersion)) {
    const message = `VERSION_MISMATCH: client protocol version is invalid (received "${requestedVersionRaw}")`;
    reject('VERSION_MISMATCH', message);
  }

  if (requestedVersion !== expectedProtocolVersion) {
    const message = `VERSION_MISMATCH: client protocol version ${requestedVersion} does not match server version ${expectedProtocolVersion}`;
    reject('VERSION_MISMATCH', message);
  }

  let claims: AccessTokenClaims | undefined;

  if (authSettings.enabled) {
    const token = options.accessToken?.trim();
    if (!token) {
      logAuthEvent({
        type: 'auth.token.missing',
        sessionId: client.sessionId
      });
      reject('AUTH_REQUIRED', 'AUTH_REQUIRED: access token is required to join');
    }

    try {
      claims = await validateAccessToken(token!, {
        jwksUri: authSettings.jwksUri!,
        audience: authSettings.audience!,
        issuer: authSettings.issuer!
      });
      logAuthEvent({
        type: 'auth.token.validated',
        playerId: claims.oid ?? claims.sub ?? client.sessionId,
        sessionId: client.sessionId,
        claims
      });
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : 'failed to validate access token';
      logAuthEvent({
        type: 'auth.token.invalid',
        sessionId: client.sessionId,
        reason
      }, 'warn');
      reject('AUTH_REQUIRED', `AUTH_REQUIRED: ${reason}`);
    }
  }

  const playerId =
    claims?.oid ??
    claims?.sub ??
    options.playerId ??
    client.sessionId;

  if (claims) {
    logAuthEvent({
      type: 'auth.identity.persisted',
      playerId,
      claims
    });
  }

  return {
    playerId,
    protocolVersion: expectedProtocolVersion,
    claims
  };
};
