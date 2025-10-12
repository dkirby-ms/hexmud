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

export type AuthErrorCode =
  | 'user_cancelled'
  | 'interaction_required'
  | 'popup_blocked'
  | 'authentication_disabled'
  | 'general';

export interface AuthActionResult {
  success: boolean;
  accessToken?: string | null;
  error?: string;
  errorCode?: AuthErrorCode;
}

export interface UseAuthResult {
  status: AuthStatus;
  account: AccountInfo | null;
  accessToken: string | null;
  error?: string;
  errorCode?: AuthErrorCode | null;
  signIn: () => Promise<AuthActionResult>;
  signInRedirect: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<string | null>;
  ensureAccessToken: () => Promise<string | null>;
}

interface AuthState {
  status: AuthStatus;
  account: AccountInfo | null;
  accessToken: string | null;
  error?: string;
  errorCode?: AuthErrorCode | null;
}

const initialState: AuthState = {
  status: isMsalConfigured() ? 'loading' : 'disabled',
  account: null,
  accessToken: null,
  errorCode: null
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

const resolveErrorCode = (error: unknown): AuthErrorCode => {
  if (error instanceof InteractionRequiredAuthError) {
    const interactionError = error as InteractionRequiredAuthError & { errorCode?: string };
    switch (interactionError.errorCode) {
      case 'user_cancelled':
        return 'user_cancelled';
      case 'popup_window_error':
        return 'popup_blocked';
      default:
        return 'interaction_required';
    }
  }
  return 'general';
};

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
      setState({
        status: 'disabled',
        account: null,
        accessToken: null,
        errorCode: 'authentication_disabled'
      });
      return () => {
        mountedRef.current = false;
      };
    }

    const initialize = async () => {
      try {
        await instance.initialize();
        const redirectResult = await instance.handleRedirectPromise();
        if (redirectResult?.account) {
          instance.setActiveAccount(redirectResult.account);
          console.info('[auth] sign-in success', {
            method: 'redirect',
            username: redirectResult.account.username
          });
        }

        const account = getActiveAccount(instance);
        if (!account) {
          if (mountedRef.current) {
            setState({
              status: 'unauthenticated',
              account: null,
              accessToken: null,
              errorCode: null
            });
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
            error: undefined,
            errorCode: null
          });
        }
      } catch (error) {
        if (!mountedRef.current) {
          return;
        }
        if (error instanceof InteractionRequiredAuthError) {
          const errorCode = resolveErrorCode(error);
          setState({
            status: 'unauthenticated',
            account: null,
            accessToken: null,
            error: errorCode === 'user_cancelled' ? undefined : error.message,
            errorCode
          });
          return;
        }
        const message = error instanceof Error ? error.message : 'Authentication failed';
        setState({
          status: 'error',
          account: null,
          accessToken: null,
          error: message,
          errorCode: resolveErrorCode(error)
        });
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
      setState({
        status: 'unauthenticated',
        account: null,
        accessToken: null,
        errorCode: null
      });
      return null;
    }

    try {
      const result = await acquireToken(instance, account);
      if (mountedRef.current) {
        setState({
          status: 'authenticated',
          account,
          accessToken: result.accessToken ?? null,
          error: undefined,
          errorCode: null
        });
      }
      return result.accessToken ?? null;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        if (mountedRef.current) {
          setState({
            status: 'unauthenticated',
            account: null,
            accessToken: null,
            errorCode: resolveErrorCode(error)
          });
        }
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Authentication failed';
      if (mountedRef.current) {
        setState({
          status: 'error',
          account: null,
          accessToken: null,
          error: message,
          errorCode: resolveErrorCode(error)
        });
      }
      throw error instanceof Error ? error : new Error(message);
    }
  }, []);

  const signIn = useCallback(async (): Promise<AuthActionResult> => {
    const instance = instanceRef.current;
    if (!instance) {
      return {
        success: false,
        error: 'Authentication is disabled',
        errorCode: 'authentication_disabled'
      };
    }

    try {
      const result = await instance.loginPopup({
        scopes: msalScopes.length > 0 ? [...msalScopes] : ['openid']
      });
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
          error: undefined,
          errorCode: null
        });
      }
      console.info('[auth] sign-in success', {
        method: 'popup',
        username: account.username
      });
      return { success: true, accessToken: accessToken ?? null };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authentication failed';
      const errorCode = resolveErrorCode(error);
      if (mountedRef.current) {
        setState({
          status: 'unauthenticated',
          account: null,
          accessToken: null,
          error: errorCode === 'user_cancelled' ? undefined : message,
          errorCode
        });
      }
      console.warn('[auth] sign-in failure', {
        method: 'popup',
        reason: errorCode,
        message
      });
      return { success: false, error: message, errorCode };
    }
  }, []);

  const signInRedirect = useCallback(async (): Promise<void> => {
    const instance = instanceRef.current;
    if (!instance) {
      return;
    }
    // If already authenticated, no-op
    if (state.status === 'authenticated') {
      return;
    }
    try {
      console.info('[auth] sign-in redirect initiated', { method: 'redirect' });
      // Decision D1: redirect flow is primary; popup is retained as fallback for tests or constrained contexts.
      await instance.loginRedirect({ scopes: msalScopes.length > 0 ? [...msalScopes] : ['openid'] });
      // Redirect will leave page; post-redirect flow handled in initialization effect via handleRedirectPromise.
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Redirect sign-in failed';
      const errorCode = resolveErrorCode(error);
      console.warn('[auth] sign-in redirect failure', {
        reason: errorCode,
        message
      });
      if (mountedRef.current) {
        setState({
          status: 'unauthenticated',
          account: null,
          accessToken: null,
          error: errorCode === 'user_cancelled' ? undefined : message,
          errorCode
        });
      }
    }
  }, [state.status]);

  const signOut = useCallback(async () => {
    const instance = instanceRef.current;
    if (!instance) {
      setState({
        status: 'disabled',
        account: null,
        accessToken: null,
        errorCode: 'authentication_disabled'
      });
      return;
    }

    if (initializationRef.current) {
      await initializationRef.current;
    }

    try {
      await instance.logoutPopup();
    } finally {
      if (mountedRef.current) {
        console.info('[auth] sign-out success');
        setState({
          status: 'unauthenticated',
          account: null,
          accessToken: null,
          errorCode: null
        });
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
      errorCode: state.errorCode ?? null,
      signIn,
      signInRedirect,
      signOut,
      refresh,
      ensureAccessToken
    }),
    [state, signIn, signInRedirect, signOut, refresh, ensureAccessToken]
  );
};
