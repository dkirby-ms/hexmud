import type { Configuration } from '@azure/msal-browser';

const getEnv = (key: string) => {
  const env = import.meta.env as Record<string, string | undefined>;
  const value = env[key];
  return typeof value === 'string' ? value : '';
};

const clientId = getEnv('VITE_MSAL_CLIENT_ID');
const authority = getEnv('VITE_MSAL_AUTHORITY');
const redirectUri = getEnv('VITE_MSAL_REDIRECT_URI') || window.location.origin;
const scopesEnv = getEnv('VITE_MSAL_SCOPES');

const normalizeScopes = (value: string): string[] => {
  if (!value) {
    return ['openid', 'profile'];
  }
  return value
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean);
};

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: authority || undefined,
    redirectUri
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false
  }
};

export const isMsalConfigured = (): boolean => Boolean(msalConfig.auth.clientId);

export const msalScopes = Object.freeze(normalizeScopes(scopesEnv));
