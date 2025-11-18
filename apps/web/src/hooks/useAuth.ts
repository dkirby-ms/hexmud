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

const RENEWAL_WINDOW_MS = 5 * 60_000;
const RENEWAL_BASE_INTERVAL_MS = 60_000;
const RENEWAL_MAX_BACKOFF_MS = 5 * 60_000;
const SIGN_OUT_SENTINEL_KEY = 'hexmud:auth:signout';

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
  const renewalStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renewalRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renewalAttemptRef = useRef(0);
  const scheduleRenewalRef = useRef<
    ((expiresOn: Date | null | undefined) => void) | null
  >(null);
  const attemptRenewalRef = useRef<((attempt: number) => Promise<void>) | null>(null);

  const clearRenewalTimers = useCallback(() => {
    if (renewalStartTimerRef.current) {
      clearTimeout(renewalStartTimerRef.current);
      renewalStartTimerRef.current = null;
    }
    if (renewalRetryTimerRef.current) {
      clearTimeout(renewalRetryTimerRef.current);
      renewalRetryTimerRef.current = null;
    }
    renewalAttemptRef.current = 0;
  }, []);

  const broadcastSignOut = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(SIGN_OUT_SENTINEL_KEY, Date.now().toString());
      window.localStorage.removeItem(SIGN_OUT_SENTINEL_KEY);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[auth] sign-out broadcast failed', error);
      }
    }
  }, []);

  const scheduleRenewal = useCallback(
    (expiresOn: Date | null | undefined) => {
      clearRenewalTimers();
      if (!expiresOn) {
        return;
      }

      const expiryMs = expiresOn.getTime();
      const now = Date.now();
      const windowStart = expiryMs - RENEWAL_WINDOW_MS;
      const delay = windowStart > now ? windowStart - now : RENEWAL_BASE_INTERVAL_MS;

      renewalStartTimerRef.current = setTimeout(() => {
        renewalAttemptRef.current = 0;
  void attemptRenewalRef.current?.(1);
      }, delay);
    },
    [clearRenewalTimers]
  );

  const attemptRenewal = useCallback(
    async (attempt: number) => {
      const instance = instanceRef.current;
      if (!instance) {
        return;
      }

      if (initializationRef.current) {
        await initializationRef.current;
      }

      const account = getActiveAccount(instance);
      if (!account) {
        clearRenewalTimers();
        return;
      }

      try {
          const result = await acquireToken(instance, account);
        console.info('[auth] renewal success', { attempt });
        renewalAttemptRef.current = 0;
          if (mountedRef.current) {
          setState({
            status: 'authenticated',
            account,
            accessToken: result.accessToken ?? null,
            error: undefined,
            errorCode: null
          });
        }
          scheduleRenewalRef.current?.(result.expiresOn ?? null);
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Unknown error';
        renewalAttemptRef.current = attempt;
        console.warn('[auth] renewal failure', {
          attempt,
          reason
        });

        const isInteractionRequired = error instanceof InteractionRequiredAuthError;
        if (!isInteractionRequired) {
          const delay = Math.min(
            RENEWAL_MAX_BACKOFF_MS,
            RENEWAL_BASE_INTERVAL_MS * Math.max(1, 2 ** (attempt - 1))
          );
          renewalRetryTimerRef.current = setTimeout(() => {
            void attemptRenewalRef.current?.(attempt + 1);
          }, delay);
        } else {
          clearRenewalTimers();
        }

        if (isInteractionRequired && mountedRef.current) {
          const errorCode = resolveErrorCode(error);
          setState({
            status: 'unauthenticated',
            account: null,
            accessToken: null,
            error: errorCode === 'user_cancelled' ? undefined : reason,
            errorCode
          });
        }
      }
    },
    [clearRenewalTimers]
  );

  useEffect(() => {
    scheduleRenewalRef.current = scheduleRenewal;
    attemptRenewalRef.current = attemptRenewal;
  }, [scheduleRenewal, attemptRenewal]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== SIGN_OUT_SENTINEL_KEY || !event.newValue) {
        return;
      }
      clearRenewalTimers();
      if (mountedRef.current) {
        setState({
          status: 'unauthenticated',
          account: null,
          accessToken: null,
          errorCode: null
        });
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, [clearRenewalTimers]);

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
          clearRenewalTimers();
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
        scheduleRenewal(result.expiresOn ?? null);
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
        clearRenewalTimers();
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
      clearRenewalTimers();
    };
  }, [clearRenewalTimers, scheduleRenewal]);

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
      clearRenewalTimers();
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
      scheduleRenewal(result.expiresOn ?? null);
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
        clearRenewalTimers();
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
      clearRenewalTimers();
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
  }, [clearRenewalTimers, scheduleRenewal]);

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
      const needsSilentToken = !result.expiresOn;
      const tokenResult = needsSilentToken ? await acquireToken(instance, account) : result;
      const accessToken = result.accessToken ?? tokenResult.accessToken ?? null;
      scheduleRenewal(tokenResult.expiresOn ?? result.expiresOn ?? null);
      if (mountedRef.current) {
        setState({
          status: 'authenticated',
          account,
          accessToken,
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
      clearRenewalTimers();
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
  }, [clearRenewalTimers, scheduleRenewal]);

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
      clearRenewalTimers();
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
      clearRenewalTimers();
      broadcastSignOut();
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
  }, [broadcastSignOut, clearRenewalTimers]);

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
