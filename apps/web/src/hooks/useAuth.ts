import {
  InteractionRequiredAuthError,
  type AccountInfo,
  type AuthenticationResult,
  type PublicClientApplication
} from '@azure/msal-browser';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';


import { initMsal } from '../services/auth/initMsal.js';
import { isMsalConfigured, msalScopes } from '../services/auth/msalConfig.js';

export type AuthStatus = 'disabled' | 'loading' | 'authenticated' | 'unauthenticated' | 'error';

export interface AuthActionResult {
  success: boolean;
  accessToken?: string | null;
  error?: string;
}

export interface UseAuthResult {
  status: AuthStatus;
  account: AccountInfo | null;
  accessToken: string | null;
  error?: string;
  signIn: () => Promise<AuthActionResult>;
  signOut: () => Promise<void>;
  refresh: () => Promise<string | null>;
  ensureAccessToken: () => Promise<string | null>;
}

interface AuthState {
  status: AuthStatus;
  account: AccountInfo | null;
  accessToken: string | null;
  error?: string;
}

const initialState: AuthState = {
  status: isMsalConfigured() ? 'loading' : 'disabled',
  account: null,
  accessToken: null
};

const getActiveAccount = (instance: PublicClientApplication): AccountInfo | null => {
  const active = instance.getActiveAccount();
  if (active) {
    return active;
  }
  const [first] = instance.getAllAccounts();
  return first ?? null;
};

const acquireToken = async (
  instance: PublicClientApplication,
  account: AccountInfo
): Promise<AuthenticationResult> =>
  instance.acquireTokenSilent({
    account,
    scopes: msalScopes.length > 0 ? [...msalScopes] : ['openid']
  });

export const useAuth = (): UseAuthResult => {
  const [state, setState] = useState<AuthState>(initialState);
  const instanceRef = useRef<PublicClientApplication | null>(null);
  const initializationRef = useRef<Promise<void> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const instance = initMsal();
    instanceRef.current = instance;

    if (!instance) {
      setState({ status: 'disabled', account: null, accessToken: null });
      return () => {
        mountedRef.current = false;
      };
    }

    const initialize = async () => {
      try {
        await instance.initialize();
        await instance.handleRedirectPromise();

        const account = getActiveAccount(instance);
        if (!account) {
          if (mountedRef.current) {
            setState({ status: 'unauthenticated', account: null, accessToken: null });
          }
          return;
        }

        instance.setActiveAccount(account);
        const result = await acquireToken(instance, account);
        if (mountedRef.current) {
          setState({
            status: 'authenticated',
            account,
            accessToken: result.accessToken ?? null,
            error: undefined
          });
        }
      } catch (error) {
        if (!mountedRef.current) {
          return;
        }
        if (error instanceof InteractionRequiredAuthError) {
          setState({ status: 'unauthenticated', account: null, accessToken: null });
          return;
        }
        const message = error instanceof Error ? error.message : 'Authentication failed';
        setState({ status: 'error', account: null, accessToken: null, error: message });
      }
    };

    const initialization = initialize();
    initializationRef.current = initialization;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async (): Promise<string | null> => {
    const instance = instanceRef.current;
    if (!instance) {
      return null;
    }

    if (initializationRef.current) {
      await initializationRef.current;
    }

    const account = getActiveAccount(instance);
    if (!account) {
      setState({ status: 'unauthenticated', account: null, accessToken: null });
      return null;
    }

    try {
      const result = await acquireToken(instance, account);
      if (mountedRef.current) {
        setState({
          status: 'authenticated',
          account,
          accessToken: result.accessToken ?? null,
          error: undefined
        });
      }
      return result.accessToken ?? null;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        if (mountedRef.current) {
          setState({ status: 'unauthenticated', account: null, accessToken: null });
        }
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Authentication failed';
      if (mountedRef.current) {
        setState({ status: 'error', account: null, accessToken: null, error: message });
      }
      throw error instanceof Error ? error : new Error(message);
    }
  }, []);

  const signIn = useCallback(async (): Promise<AuthActionResult> => {
    const instance = instanceRef.current;
    if (!instance) {
      return { success: false, error: 'Authentication is disabled' };
    }

    try {
  const result = await instance.loginPopup({ scopes: msalScopes.length > 0 ? [...msalScopes] : ['openid'] });
      const account = result.account ?? getActiveAccount(instance);
      if (!account) {
        throw new Error('Login did not return an account');
      }
      instance.setActiveAccount(account);
      const accessToken = result.accessToken || (await acquireToken(instance, account)).accessToken;
      if (mountedRef.current) {
        setState({
          status: 'authenticated',
          account,
          accessToken: accessToken ?? null,
          error: undefined
        });
      }
      return { success: true, accessToken: accessToken ?? null };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authentication failed';
      if (mountedRef.current) {
        setState({ status: 'unauthenticated', account: null, accessToken: null, error: message });
      }
      return { success: false, error: message };
    }
  }, []);

  const signOut = useCallback(async () => {
    const instance = instanceRef.current;
    if (!instance) {
      setState({ status: 'disabled', account: null, accessToken: null });
      return;
    }

    if (initializationRef.current) {
      await initializationRef.current;
    }

    try {
      await instance.logoutPopup();
    } finally {
      if (mountedRef.current) {
        setState({ status: 'unauthenticated', account: null, accessToken: null });
      }
    }
  }, []);

  const ensureAccessToken = useCallback(async (): Promise<string | null> => {
    const instance = instanceRef.current;
    if (!instance) {
      return null;
    }

    try {
      const token = await refresh();
      if (token) {
        return token;
      }
    } catch (error) {
      if (!(error instanceof InteractionRequiredAuthError)) {
        throw error instanceof Error ? error : new Error('Failed to refresh access token');
      }
    }

    const result = await signIn();
    if (!result.success) {
      throw new Error(result.error ?? 'Authentication required');
    }
    return result.accessToken ?? null;
  }, [refresh, signIn]);

  return useMemo(
    () => ({
      status: state.status,
      account: state.account,
      accessToken: state.accessToken,
      error: state.error,
      signIn,
      signOut,
      refresh,
      ensureAccessToken
    }),
    [state, signIn, signOut, refresh, ensureAccessToken]
  );
};
