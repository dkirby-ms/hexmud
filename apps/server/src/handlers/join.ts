import { type ErrorCode } from '@hexmud/protocol';
import type { Client } from 'colyseus';

import { extractRoles } from '../auth/extractRoles.js';
import { getOpenIdConfiguration, OpenIdConfigurationError } from '../auth/openidConfiguration.js';
import {
  AccessTokenValidationError,
  type AccessTokenClaims,
  type AccessTokenValidationReason,
  validateAccessToken
} from '../auth/validateToken.js';
import { env } from '../config/env.js';
import type { AuthLogEvent } from '../logging/events.js';
import { logger } from '../logging/logger.js';
import {
  incrementRenewalFailure,
  incrementRenewalSuccess,
  incrementTokenValidationFailure,
  incrementTokenValidationTotal
} from '../metrics/adapter.js';

import { resolveAuthErrorMessage, type AuthRejectionReason, sendErrorEnvelope } from './error.js';

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
  roles: string[];
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
  const { apiAudience, authority, jwksUri, requiredScope } = env.msal;
  const enabled = Boolean(apiAudience && authority);

  return {
    enabled,
    authority: authority ?? undefined,
    audience: apiAudience ?? undefined,
    jwksUri: jwksUri ?? undefined,
    requiredScopeName: requiredScope.name ?? undefined
  } as const;
})();

const mapValidationReasonToRejection = (
  reason: AccessTokenValidationReason
): AuthRejectionReason => {
  switch (reason) {
    case 'expired':
      return 'token_expired';
    case 'nbfSkew':
      return 'token_not_yet_valid';
    case 'claimMissing':
      return 'token_claim_invalid';
    case 'revoked':
      return 'token_revoked';
    case 'signature':
    case 'other':
    default:
      return 'token_invalid';
  }
};

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
        type: 'auth.token.validation.failure',
        sessionId: client.sessionId,
        reason: 'missing_token'
      }, 'warn');
      incrementTokenValidationFailure('other', { stage: 'join' });
      reject('AUTH_REQUIRED', resolveAuthErrorMessage('missing_token'));
    }

    try {
      incrementTokenValidationTotal({ stage: 'join' });
      const discovery = await getOpenIdConfiguration(authSettings.authority!);
      const jwksUri = discovery.jwks_uri ?? authSettings.jwksUri;

      if (!jwksUri) {
        logAuthEvent({
          type: 'auth.token.validation.failure',
          sessionId: client.sessionId,
          reason: 'jwks_missing'
        }, 'warn');
        incrementTokenValidationFailure('other', { stage: 'join' });
        reject('AUTH_REQUIRED', resolveAuthErrorMessage('token_invalid'));
      }

      claims = await validateAccessToken(token!, {
        jwksUri,
        audience: authSettings.audience!,
        issuer: discovery.issuer
      });

      if (authSettings.requiredScopeName) {
        const scopeList = claims.scp ? claims.scp.split(' ').filter(Boolean) : [];
        if (!scopeList.includes(authSettings.requiredScopeName)) {
          incrementTokenValidationFailure('claimMissing', { stage: 'join' });
          incrementRenewalFailure('claimMissing', { stage: 'join' });
          logAuthEvent({
            type: 'auth.token.validation.failure',
            sessionId: client.sessionId,
            reason: 'scope_missing'
          }, 'warn');
          reject('AUTH_REQUIRED', resolveAuthErrorMessage('token_claim_invalid'));
        }
      }
    } catch (error) {
      let failureReason: AuthRejectionReason = 'token_invalid';
      let metricsReason: AccessTokenValidationReason = 'other';
  let logReason = 'other';

      if (error instanceof OpenIdConfigurationError) {
        logReason = `openid_${error.code}`;
      } else if (error instanceof AccessTokenValidationError) {
        metricsReason = error.reason;
        failureReason = mapValidationReasonToRejection(error.reason);
        logReason = error.reason;
        if (error.reason === 'expired') {
          logAuthEvent(
            {
              type: 'auth.renewal.failure',
              sessionId: client.sessionId,
              reason: 'expired'
            },
            'warn'
          );
          incrementRenewalFailure('expired', { stage: 'join' });
        } else {
          incrementRenewalFailure(error.reason, { stage: 'join' });
        }
      } else {
        incrementRenewalFailure('other', { stage: 'join' });
      }

      const message = resolveAuthErrorMessage(failureReason);

      incrementTokenValidationFailure(metricsReason, { stage: 'join' });
      logAuthEvent({
        type: 'auth.token.validation.failure',
        sessionId: client.sessionId,
        reason: logReason
      }, 'warn');
      reject('AUTH_REQUIRED', message);
    }
  }

  const playerId =
    claims?.oid ??
    claims?.sub ??
    options.playerId ??
    client.sessionId;

  if (claims) {
    logAuthEvent({
      type: 'auth.signin.success',
      sessionId: client.sessionId,
      playerId
    });
    logAuthEvent({
      type: 'auth.renewal.success',
      sessionId: client.sessionId,
      playerId
    });
    incrementRenewalSuccess({ stage: 'join' });
  }

  const roles = extractRoles(claims);

  return {
    playerId,
    protocolVersion: expectedProtocolVersion,
    claims,
    roles
  };
};
