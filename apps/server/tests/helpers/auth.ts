/**
 * Provides a mock identity provider for integration tests.
 * Tokens default to a one-hour lifetime; callers can shorten expiry to exercise
 * the <5 minute renewal window enforced by the client feature plan (D2).
 */
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
  requiredScope: string;
}

interface MockIdentityProvider {
  audience: string;
  issuer: string;
  jwksUri: string;
  issueToken: (claims?: Partial<AccessTokenClaims>) => Promise<string>;
  stop: () => Promise<void>;
  requiredScope: string;
}

const createMockIdentityProvider = async (): Promise<MockIdentityProvider> => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const kid = randomUUID();
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = kid;
  publicJwk.use = 'sig';
  publicJwk.alg = 'RS256';

  const tenantId = randomUUID();
  const jwksPath = '/.well-known/jwks.json';
  const openIdConfigPath = `/${tenantId}/v2.0/.well-known/openid-configuration`;

  let authorityBase: string | undefined;
  let issuer: string | undefined;
  let jwksUri: string | undefined;

  const server = createServer((req, res) => {
    if (req.method === 'GET' && req.url === jwksPath) {
      res.writeHead(200, {
        'content-type': 'application/json'
      });
      res.end(JSON.stringify({ keys: [publicJwk] }));
      return;
    }

    if (req.method === 'GET' && req.url === openIdConfigPath) {
      if (!issuer || !jwksUri || !authorityBase) {
        res.writeHead(503);
        res.end();
        return;
      }
      res.writeHead(200, {
        'content-type': 'application/json',
        'cache-control': 'max-age=60'
      });
      res.end(
        JSON.stringify({
          issuer,
          jwks_uri: jwksUri,
          authorization_endpoint: `${authorityBase}/oauth2/v2.0/authorize`,
          token_endpoint: `${authorityBase}/oauth2/v2.0/token`
        })
      );
      return;
    }

    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as AddressInfo;
  authorityBase = `http://127.0.0.1:${address.port}/${tenantId}`;
  issuer = `${authorityBase}/v2.0`;
  const audience = `test-client-${randomUUID()}`;
  jwksUri = `http://127.0.0.1:${address.port}${jwksPath}`;
  const requiredScopeName = 'GameService.Access';
  const requiredScopeFull = `api://${audience}/${requiredScopeName}`;

  const issueToken = async (claims: Partial<AccessTokenClaims> = {}): Promise<string> => {
    const defaultOid = claims.oid ?? randomUUID();
    const { nbf, exp, ...restClaims } = claims;
    const scopeClaim = restClaims.scp ?? requiredScopeName;

    return new SignJWT({
      preferred_username: restClaims.preferred_username ?? 'player@example.com',
      name: restClaims.name ?? 'Test Player',
      oid: defaultOid,
      scp: scopeClaim,
      ...restClaims
    })
      .setProtectedHeader({ alg: 'RS256', kid })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject(claims.sub ?? defaultOid)
      .setIssuedAt()
      .setNotBefore(nbf ?? '0s')
      .setExpirationTime(exp ?? '1h')
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

  return {
    audience,
    issuer,
    jwksUri,
    issueToken,
    stop,
    requiredScope: requiredScopeFull
  };
};

export const createAuthenticatedTestContext = async (): Promise<AuthenticatedTestContext> => {
  const provider = await createMockIdentityProvider();

  process.env.MSAL_AUTHORITY = provider.issuer;
  process.env.MSAL_JWKS_URI = provider.jwksUri;
  process.env.MSAL_API_AUDIENCE = provider.audience;
  process.env.MSAL_REQUIRED_SCOPE = provider.requiredScope;
  process.env.SERVER_PORT = '0';

  vi.resetModules();

  const { start } = await import('../../src/server.js');

  const teardown = async () => {
    await provider.stop();
    delete process.env.MSAL_AUTHORITY;
    delete process.env.MSAL_JWKS_URI;
    delete process.env.MSAL_API_AUDIENCE;
    delete process.env.MSAL_REQUIRED_SCOPE;
    delete process.env.SERVER_PORT;
  };

  return {
    startServer: start,
    issueToken: provider.issueToken,
    teardown,
    audience: provider.audience,
    issuer: provider.issuer,
    jwksUri: provider.jwksUri,
    requiredScope: provider.requiredScope
  };
};
