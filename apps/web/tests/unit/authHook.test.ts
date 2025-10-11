import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AccountInfo, AuthenticationResult } from '@azure/msal-browser';

const account: AccountInfo = {
  homeAccountId: 'home-account-id',
  environment: 'login.microsoftonline.com',
  tenantId: 'tenant-id',
  username: 'player@example.com',
  localAccountId: 'local-account-id',
  name: 'Player Example'
};

const initialize = vi.fn(async () => {});
const handleRedirectPromise = vi.fn(async () => null);
const getActiveAccount = vi.fn(() => null);
const getAllAccounts = vi.fn(() => [account]);
const setActiveAccount = vi.fn();
const acquireTokenSilent = vi.fn(async () => ({
  accessToken: 'token-silent'
} as AuthenticationResult));
const loginPopup = vi.fn(async () => ({
  account,
  accessToken: 'token-login'
}));
const logoutPopup = vi.fn(async () => {});

class MockInteractionRequiredAuthError extends Error {}

vi.mock('@azure/msal-browser', () => ({
  PublicClientApplication: vi.fn(() => ({
    initialize,
    handleRedirectPromise,
    getActiveAccount,
    getAllAccounts,
    setActiveAccount,
    acquireTokenSilent,
    loginPopup,
    logoutPopup
  })),
  InteractionRequiredAuthError: MockInteractionRequiredAuthError
}));

vi.mock('../../src/services/auth/msalConfig', () => ({
  msalConfig: {
    auth: {
      clientId: 'test-client-id',
      authority: 'https://login.microsoftonline.com/test-tenant',
      redirectUri: 'http://localhost'
    },
    cache: {
      cacheLocation: 'localStorage',
      storeAuthStateInCookie: false
    }
  },
  isMsalConfigured: () => true,
  msalScopes: ['User.Read']
}));

describe('useAuth', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    getAllAccounts.mockImplementation(() => [account]);
    acquireTokenSilent.mockImplementation(async () => ({
      accessToken: 'token-silent'
    } as AuthenticationResult));
    const { resetMsalInstanceForTests } = await import('../../src/services/auth/initMsal.js');
    resetMsalInstanceForTests();
  });

  it('acquires an access token silently when an account is present', async () => {
    const { useAuth } = await import('../../src/hooks/useAuth.js');
    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    expect(acquireTokenSilent).toHaveBeenCalledTimes(1);
    expect(result.current.accessToken).toBe('token-silent');
    expect(result.current.account?.username).toBe('player@example.com');
  });

  it('prompts login when no cached account exists', async () => {
  getAllAccounts.mockImplementation(() => []);

    const { useAuth } = await import('../../src/hooks/useAuth.js');
    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

    let token: string | null = null;
    await act(async () => {
      token = await result.current.ensureAccessToken();
    });

    expect(loginPopup).toHaveBeenCalledTimes(1);
    expect(token).toBe('token-login');
    expect(result.current.status).toBe('authenticated');
    expect(result.current.accessToken).toBe('token-login');
  });
});
