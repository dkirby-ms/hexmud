import { createEnvelope, type ErrorCode } from '@hexmud/protocol';
import type { Client } from 'colyseus';

export type AuthRejectionReason =
  | 'missing_token'
  | 'token_expired'
  | 'token_not_yet_valid'
  | 'token_invalid'
  | 'token_claim_invalid'
  | 'token_revoked';

const AUTH_ERROR_MESSAGES: Record<AuthRejectionReason, string> = {
  missing_token: 'AUTH_REQUIRED: access token is required to join',
  token_expired: 'AUTH_REQUIRED: access token has expired',
  token_not_yet_valid: 'AUTH_REQUIRED: access token is not yet valid',
  token_invalid: 'AUTH_REQUIRED: access token is invalid',
  token_claim_invalid: 'AUTH_REQUIRED: access token is missing required claims',
  token_revoked: 'AUTH_REQUIRED: access token has been revoked'
};

export const resolveAuthErrorMessage = (reason: AuthRejectionReason): string =>
  AUTH_ERROR_MESSAGES[reason] ?? AUTH_ERROR_MESSAGES.token_invalid;

export const sendErrorEnvelope = (client: Client, code: ErrorCode, message: string): void => {
  client.send(
    'envelope',
    createEnvelope('error', {
      code,
      message
    })
  );
};
