import { errors as joseErrors, jwtVerify, type JWTPayload, type JWTVerifyResult } from 'jose';

import { getRemoteJwks } from './jwks.js';

export interface ValidateAccessTokenOptions {
  jwksUri: string;
  audience: string;
  issuer?: string | string[];
}

export interface AccessTokenClaims extends JWTPayload {
  oid?: string;
  preferred_username?: string;
  name?: string;
  moderator?: boolean;
  roles?: string[];
  scp?: string;
}

export const CLOCK_SKEW_TOLERANCE_SECONDS = 120;

export type AccessTokenValidationReason =
  | 'signature'
  | 'expired'
  | 'nbfSkew'
  | 'claimMissing'
  | 'revoked'
  | 'other';

export class AccessTokenValidationError extends Error {
  constructor(
    public readonly reason: AccessTokenValidationReason,
    message: string
  ) {
    super(message);
    this.name = 'AccessTokenValidationError';
  }
}

const mapJoseErrorToValidationError = (error: unknown): AccessTokenValidationError => {
  if (error instanceof joseErrors.JWTExpired) {
    return new AccessTokenValidationError('expired', 'Access token is expired.');
  }

  if (error instanceof joseErrors.JWTClaimValidationFailed) {
    if (error.claim === 'nbf') {
      return new AccessTokenValidationError(
        'nbfSkew',
        `Access token is not yet valid. Allowed clock skew is ±${CLOCK_SKEW_TOLERANCE_SECONDS} seconds.`
      );
    }

    if (error.claim) {
      return new AccessTokenValidationError(
        'claimMissing',
        `Access token failed validation for claim "${error.claim}".`
      );
    }

    return new AccessTokenValidationError(
      'claimMissing',
      'Access token failed required claim validation.'
    );
  }

  if (
    error instanceof joseErrors.JWSSignatureVerificationFailed ||
    error instanceof joseErrors.JWSInvalid
  ) {
    return new AccessTokenValidationError('signature', 'Access token signature is invalid.');
  }

  if (error instanceof joseErrors.JWTInvalid) {
    return new AccessTokenValidationError('other', error.message);
  }

  if (error instanceof Error) {
    return new AccessTokenValidationError('other', error.message);
  }

  return new AccessTokenValidationError('other', 'Failed to validate access token.');
};

export const validateAccessToken = async (
  token: string,
  options: ValidateAccessTokenOptions
): Promise<AccessTokenClaims> => {
  const jwks = getRemoteJwks(options.jwksUri);

  let verification: JWTVerifyResult<AccessTokenClaims>;
  try {
    verification = await jwtVerify<AccessTokenClaims>(token, jwks, {
      audience: options.audience,
      issuer: options.issuer,
      clockTolerance: CLOCK_SKEW_TOLERANCE_SECONDS
    });
  } catch (error) {
    throw mapJoseErrorToValidationError(error);
  }

  const claims = verification.payload;

  if (!claims.oid && !claims.sub) {
    throw new AccessTokenValidationError(
      'claimMissing',
      'Access token is missing a required subject claim.'
    );
  }

  return claims;
};
