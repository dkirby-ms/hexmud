import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

  afterEach(() => {
    vi.useRealTimers();
  });

  it('acquires an access token silently when an account is present', async () => {
    const { useAuth } = await import('../../src/hooks/useAuth.js');
    const { result } = renderHook(() => useAuth());

    for (let i = 0; i < 5 && result.current.status !== 'authenticated'; i += 1) {
      await act(async () => {
        await Promise.resolve();
      });
    }
    expect(result.current.status).toBe('authenticated');

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

    it('triggers silent renewal when token nears expiry', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
      const now = Date.now();

      acquireTokenSilent.mockReset();
      acquireTokenSilent.mockImplementationOnce(async () => ({
        accessToken: 'token-silent',
        expiresOn: new Date(now + 4 * 60_000)
      } as AuthenticationResult));

      acquireTokenSilent.mockImplementationOnce(async () => ({
        accessToken: 'token-renewed',
        expiresOn: new Date(now + 30 * 60_000)
      } as AuthenticationResult));

      const { useAuth } = await import('../../src/hooks/useAuth.js');
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn();
      });
    expect(result.current.status).toBe('authenticated');
    expect(result.current.accessToken).toBe('token-login');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(acquireTokenSilent.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(result.current.accessToken).toBe('token-renewed');
    });

    it('retries silent renewal with exponential backoff after failure', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
      const now = Date.now();

      const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {});
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      acquireTokenSilent.mockReset();
      acquireTokenSilent.mockImplementationOnce(async () => ({
        accessToken: 'token-silent',
        expiresOn: new Date(now + 4 * 60_000)
      } as AuthenticationResult));

      acquireTokenSilent.mockImplementationOnce(async () => {
        throw new Error('network down');
      });

      acquireTokenSilent.mockImplementationOnce(async () => ({
        accessToken: 'token-renewed',
        expiresOn: new Date(now + 40 * 60_000)
      } as AuthenticationResult));

      try {
        const { useAuth } = await import('../../src/hooks/useAuth.js');
        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn();
        });
        expect(result.current.status).toBe('authenticated');

        await act(async () => {
          await vi.advanceTimersByTimeAsync(60_000);
        });

        await act(async () => {
          await Promise.resolve();
        });

        expect(consoleWarn).toHaveBeenCalledWith('[auth] renewal failure', {
          attempt: 1,
          reason: 'network down'
        });

        await act(async () => {
          await vi.advanceTimersByTimeAsync(120_000);
        });
        await act(async () => {
          await Promise.resolve();
        });

        expect(consoleInfo).toHaveBeenCalledWith('[auth] renewal success', {
          attempt: 2
        });
        expect(result.current.accessToken).toBe('token-renewed');
      } finally {
        consoleInfo.mockRestore();
        consoleWarn.mockRestore();
      }
    });
});
