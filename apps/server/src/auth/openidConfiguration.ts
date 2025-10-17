import { setTimeout as delay } from 'node:timers/promises';

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const MIN_CACHE_TTL_MS = 30 * 1000;

export interface OpenIdConfiguration {
  issuer: string;
  jwks_uri: string;
  authorization_endpoint?: string;
  token_endpoint?: string;
  end_session_endpoint?: string;
}

interface CachedConfiguration {
  config: OpenIdConfiguration;
  expiresAt: number;
}

const configurationCache = new Map<string, CachedConfiguration>();

const buildConfigurationUrl = (authority: string): string => {
  const trimmed = authority.replace(/\/+$/, '');
  if (trimmed.length === 0) {
    throw new OpenIdConfigurationError('Authority URL is empty.', 'invalid_authority');
  }
  const withVersion = trimmed.endsWith('/v2.0') ? trimmed : `${trimmed}/v2.0`;
  return `${withVersion}/.well-known/openid-configuration`;
};

const parseCacheTtl = (response: Response): number => {
  const cacheControl = response.headers.get('cache-control');
  if (!cacheControl) {
    return DEFAULT_CACHE_TTL_MS;
  }

  const maxAgeMatch = /max-age=(\d+)/i.exec(cacheControl);
  if (!maxAgeMatch) {
    return DEFAULT_CACHE_TTL_MS;
  }

  const [, maxAgeValue] = maxAgeMatch;
  if (!maxAgeValue) {
    return DEFAULT_CACHE_TTL_MS;
  }

  const seconds = Number.parseInt(maxAgeValue, 10);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return DEFAULT_CACHE_TTL_MS;
  }

  return Math.max(seconds * 1000, MIN_CACHE_TTL_MS);
};

export type OpenIdConfigurationErrorCode =
  | 'invalid_authority'
  | 'fetch_failed'
  | 'invalid_response';

export class OpenIdConfigurationError extends Error {
  constructor(message: string, public readonly code: OpenIdConfigurationErrorCode, options?: ErrorOptions) {
    super(message, options);
    this.name = 'OpenIdConfigurationError';
  }
}

const withRetry = async <T>(operation: () => Promise<T>): Promise<T> => {
  const MAX_ATTEMPTS = 2;
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) {
        await delay(50 * attempt);
      }
    }
  }

  throw lastError;
};

export const getOpenIdConfiguration = async (authority: string): Promise<OpenIdConfiguration> => {
  const cacheKey = authority;
  const now = Date.now();
  const cached = configurationCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.config;
  }

  const configurationUrl = buildConfigurationUrl(authority);

  const response = await withRetry(() =>
    fetch(configurationUrl, {
      headers: {
        accept: 'application/json'
      }
    })
  );

  if (!response.ok) {
    throw new OpenIdConfigurationError(
      `Failed to fetch OpenID configuration (status ${response.status}).`,
      'fetch_failed'
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    throw new OpenIdConfigurationError(
      'OpenID configuration response was not valid JSON.',
      'invalid_response',
      { cause: error }
    );
  }

  if (!payload || typeof payload !== 'object') {
    throw new OpenIdConfigurationError('OpenID configuration payload is not an object.', 'invalid_response');
  }

  const { issuer, jwks_uri: jwksUri } = payload as Partial<OpenIdConfiguration>;

  if (typeof issuer !== 'string' || issuer.length === 0) {
    throw new OpenIdConfigurationError('OpenID configuration missing issuer.', 'invalid_response');
  }

  if (typeof jwksUri !== 'string' || jwksUri.length === 0) {
    throw new OpenIdConfigurationError('OpenID configuration missing jwks_uri.', 'invalid_response');
  }

  const config: OpenIdConfiguration = {
    issuer,
    jwks_uri: jwksUri,
    authorization_endpoint: (payload as Partial<OpenIdConfiguration>).authorization_endpoint,
    token_endpoint: (payload as Partial<OpenIdConfiguration>).token_endpoint,
    end_session_endpoint: (payload as Partial<OpenIdConfiguration>).end_session_endpoint
  };

  const ttl = parseCacheTtl(response);
  configurationCache.set(cacheKey, {
    config,
    expiresAt: now + ttl
  });

  return config;
};

export const clearOpenIdConfigurationCache = () => {
  configurationCache.clear();
};
