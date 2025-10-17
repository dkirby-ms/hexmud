import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { validateAccessToken, CLOCK_SKEW_TOLERANCE_SECONDS } from '../../src/auth/validateToken.js';
import { createAuthenticatedTestContext, type AuthenticatedTestContext } from '../helpers/auth.js';

describe('validateAccessToken clock skew handling', () => {
  let context: AuthenticatedTestContext | null = null;

  beforeAll(async () => {
    context = await createAuthenticatedTestContext();
  });

  afterAll(async () => {
    await context?.teardown();
  });

  it('accepts tokens with nbf slightly in the future within tolerance', async () => {
    const accessToken = await context!.issueToken({
      nbf: Math.floor(Date.now() / 1000) + CLOCK_SKEW_TOLERANCE_SECONDS - 10
    });

    await expect(
      validateAccessToken(accessToken, {
        jwksUri: context!.jwksUri,
        audience: context!.audience,
        issuer: context!.issuer
      })
    ).resolves.toBeDefined();
  });

  it('rejects tokens with nbf beyond the accepted skew window', async () => {
    const accessToken = await context!.issueToken({
      nbf: Math.floor(Date.now() / 1000) + CLOCK_SKEW_TOLERANCE_SECONDS + 30
    });

    await expect(
      validateAccessToken(accessToken, {
        jwksUri: context!.jwksUri,
        audience: context!.audience,
        issuer: context!.issuer
      })
    ).rejects.toThrow(/not yet valid/i);
  });
});
