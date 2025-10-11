import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import { vi } from 'vitest';

import type { AccessTokenClaims } from '../../src/auth/validateToken.js';

type StartServerFn = typeof import('../../src/server.js')['start'];

export interface AuthenticatedTestContext {
  startServer: StartServerFn;
  issueToken: (claims?: Partial<AccessTokenClaims>) => Promise<string>;
  teardown: () => Promise<void>;
  audience: string;
  issuer: string;
  jwksUri: string;
}

interface MockIdentityProvider {
  audience: string;
  issuer: string;
  jwksUri: string;
  issueToken: (claims?: Partial<AccessTokenClaims>) => Promise<string>;
  stop: () => Promise<void>;
}

const createMockIdentityProvider = async (): Promise<MockIdentityProvider> => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const kid = randomUUID();
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = kid;
  publicJwk.use = 'sig';
  publicJwk.alg = 'RS256';

  const jwksPath = '/.well-known/jwks.json';
  const server = createServer((req, res) => {
    if (req.method === 'GET' && req.url === jwksPath) {
      res.writeHead(200, {
        'content-type': 'application/json'
      });
      res.end(JSON.stringify({ keys: [publicJwk] }));
      return;
    }

    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as AddressInfo;
  const issuer = `https://login.microsoftonline.com/${randomUUID()}/v2.0`;
  const audience = `test-client-${randomUUID()}`;
  const jwksUri = `http://127.0.0.1:${address.port}${jwksPath}`;

  const issueToken = async (claims: Partial<AccessTokenClaims> = {}): Promise<string> => {
    const defaultOid = claims.oid ?? randomUUID();

    return new SignJWT({
      preferred_username: claims.preferred_username ?? 'player@example.com',
      name: claims.name ?? 'Test Player',
      oid: defaultOid,
      ...claims
    })
      .setProtectedHeader({ alg: 'RS256', kid })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject(claims.sub ?? defaultOid)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey);
  };

  const stop = async () =>
    new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });

  return { audience, issuer, jwksUri, issueToken, stop };
};

export const createAuthenticatedTestContext = async (): Promise<AuthenticatedTestContext> => {
  const provider = await createMockIdentityProvider();

  process.env.MSAL_CLIENT_ID = provider.audience;
  process.env.MSAL_AUTHORITY = provider.issuer;
  process.env.MSAL_JWKS_URI = provider.jwksUri;
  process.env.SERVER_PORT = '0';

  vi.resetModules();

  const { start } = await import('../../src/server.js');

  const teardown = async () => {
    await provider.stop();
    delete process.env.MSAL_CLIENT_ID;
    delete process.env.MSAL_AUTHORITY;
    delete process.env.MSAL_JWKS_URI;
    delete process.env.SERVER_PORT;
  };

  return {
    startServer: start,
    issueToken: provider.issueToken,
    teardown,
    audience: provider.audience,
    issuer: provider.issuer,
    jwksUri: provider.jwksUri
  };
};
