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

const initialize = vi.fn<() => Promise<void>>(async () => {});
const handleRedirectPromise = vi.fn<() => Promise<AuthenticationResult | null>>(async () => null);
const getActiveAccount = vi.fn<() => AccountInfo | null>(() => null);
const getAllAccounts = vi.fn<() => AccountInfo[]>(() => [account]);
const setActiveAccount = vi.fn<(nextAccount: AccountInfo) => void>();
const acquireTokenSilent = vi.fn<() => Promise<AuthenticationResult>>(async () => ({
  accessToken: 'token-silent'
} as AuthenticationResult));
const loginPopup = vi.fn<() => Promise<AuthenticationResult>>(async () => ({
  account,
  accessToken: 'token-login'
} as AuthenticationResult));
const logoutPopup = vi.fn<() => Promise<void>>(async () => {});

class MockInteractionRequiredAuthError extends Error {
  constructor(message: string, public readonly errorCode: string = 'interaction_required') {
    super(message);
  }
}

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

    it('authenticates when handleRedirectPromise returns a redirect result', async () => {
      handleRedirectPromise.mockImplementation(async () => {
        getActiveAccount.mockImplementation(() => account);
        return {
          account,
          accessToken: 'token-redirect'
        } as AuthenticationResult;
      });

      const { useAuth } = await import('../../src/hooks/useAuth.js');
      const { result } = renderHook(() => useAuth());

      await waitFor(() => expect(result.current.status).toBe('authenticated'));

      expect(handleRedirectPromise).toHaveBeenCalledTimes(1);
      expect(setActiveAccount).toHaveBeenCalledWith(account);
    expect(acquireTokenSilent).toHaveBeenCalledTimes(1);
    expect(result.current.accessToken).toBe('token-silent');
    expect(result.current.errorCode).toBeNull();
    });

    it('remains unauthenticated when redirect flow is cancelled by the user', async () => {
      handleRedirectPromise.mockImplementation(async () => {
        throw new MockInteractionRequiredAuthError('User cancelled', 'user_cancelled');
      });

      const { useAuth } = await import('../../src/hooks/useAuth.js');
      const { result } = renderHook(() => useAuth());

      await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

      expect(result.current.error).toBeUndefined();
      expect(result.current.errorCode).toBe('user_cancelled');
      expect(acquireTokenSilent).not.toHaveBeenCalled();
    });
});
