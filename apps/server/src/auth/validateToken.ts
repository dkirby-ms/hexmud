import { jwtVerify, type JWTPayload, type JWTVerifyResult } from 'jose';

import { getRemoteJwks } from './jwks.js';

export interface ValidateAccessTokenOptions {
  jwksUri: string;
  audience: string;
  issuer: string;
}

export interface AccessTokenClaims extends JWTPayload {
  oid?: string;
  preferred_username?: string;
  name?: string;
}

export const validateAccessToken = async (
  token: string,
  options: ValidateAccessTokenOptions
): Promise<AccessTokenClaims> => {
  const jwks = getRemoteJwks(options.jwksUri);

  let verification: JWTVerifyResult<AccessTokenClaims>;
  try {
    verification = await jwtVerify<AccessTokenClaims>(token, jwks, {
      audience: options.audience,
      issuer: options.issuer
    });
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Failed to validate access token'
    );
  }

  return verification.payload;
};
