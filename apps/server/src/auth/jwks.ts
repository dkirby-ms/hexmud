import { createRemoteJWKSet } from 'jose';

type RemoteJwks = ReturnType<typeof createRemoteJWKSet>;

const jwksCache = new Map<string, RemoteJwks>();

export const getRemoteJwks = (jwksUri: string, options?: Parameters<typeof createRemoteJWKSet>[1]) => {
  if (!jwksCache.has(jwksUri)) {
    jwksCache.set(jwksUri, createRemoteJWKSet(new URL(jwksUri), options));
  }
  return jwksCache.get(jwksUri)!;
};

export const clearJwksCache = () => {
  jwksCache.clear();
};
