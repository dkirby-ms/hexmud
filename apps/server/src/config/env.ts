import { PROTOCOL_VERSION } from '@hexmud/protocol';
import { config as loadEnv } from 'dotenv';


if (process.env.NODE_ENV !== 'production') {
  loadEnv();
}

const parseNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseFloatNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

const trimTrailingSlash = (value: string | null): string | null => {
  if (!value) {
    return value;
  }
  return value.endsWith('/') ? value.slice(0, -1) : value;
};

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent';

const normalizeLogLevel = (value: string | undefined): LogLevel => {
  const candidates: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error', 'silent'];
  if (value && candidates.includes(value.toLowerCase() as LogLevel)) {
    return value.toLowerCase() as LogLevel;
  }
  return 'info';
};

export interface ServerEnv {
  nodeEnv: string;
  port: number;
  host: string;
  logLevel: LogLevel;
  protocolVersion: number;
  buildNumber: number;
  heartbeatIntervalMs: number;
  heartbeatTimeoutMs: number;
  metricsEnabled: boolean;
  heartbeatRateLimit: {
    capacity: number;
    refillAmount: number;
    refillIntervalMs: number;
  };
  database: {
    url: string | null;
    maxConnections: number;
  };
  presence: {
    cap: number;
    floorPercent: number;
    decayPercent: number;
    inactivityMs: number;
    intervalMs: number;
    dwellFraction: number;
  };
  msal: {
    clientId: string | null;
    tenantId: string | null;
    authority: string | null;
    jwksUri: string | null;
    apiAudience: string | null;
    requiredScope: {
      full: string | null;
      name: string | null;
    };
  };
  world: {
    key: string;
    boundaryPolicy: 'hard-edge';
  };
}

const authority = trimTrailingSlash(process.env.MSAL_AUTHORITY ?? null);
const jwksUriOverride = process.env.MSAL_JWKS_URI ?? null;
const apiAudience = process.env.MSAL_API_AUDIENCE ?? null;
const requiredScopeFull = process.env.MSAL_REQUIRED_SCOPE ?? null;
const requiredScopeName = requiredScopeFull
  ? requiredScopeFull.split('/').slice(-1)[0] ?? null
  : null;

export const env: ServerEnv = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseNumber(process.env.SERVER_PORT, 2567),
  host: process.env.SERVER_HOST ?? '0.0.0.0',
  logLevel: normalizeLogLevel(process.env.LOG_LEVEL),
  protocolVersion: parseNumber(process.env.PROTOCOL_VERSION, PROTOCOL_VERSION),
  buildNumber: parseNumber(process.env.SERVER_BUILD_NUMBER, 1),
  heartbeatIntervalMs: parseNumber(process.env.HEARTBEAT_INTERVAL_MS, 5_000),
  heartbeatTimeoutMs: parseNumber(process.env.HEARTBEAT_TIMEOUT_MS, 30_000),
  metricsEnabled: parseBoolean(process.env.METRICS_ENABLED, false),
  heartbeatRateLimit: {
    capacity: parseNumber(process.env.HEARTBEAT_RATE_LIMIT_CAPACITY, 3),
    refillAmount: parseNumber(process.env.HEARTBEAT_RATE_LIMIT_REFILL_AMOUNT, 1),
    refillIntervalMs: parseNumber(process.env.HEARTBEAT_RATE_LIMIT_INTERVAL_MS, 1_000)
  },
  database: {
    url: process.env.DATABASE_URL ?? null,
    maxConnections: parseNumber(process.env.DATABASE_MAX_CONNECTIONS, 10)
  },
  presence: {
    cap: parseNumber(process.env.PRESENCE_CAP, 100),
    floorPercent: parseFloatNumber(process.env.PRESENCE_FLOOR_PERCENT, 0.1),
    decayPercent: parseFloatNumber(process.env.PRESENCE_DECAY_PERCENT, 0.05),
    inactivityMs: parseNumber(process.env.PRESENCE_INACTIVITY_MS, 86_400_000),
    intervalMs: parseNumber(process.env.PRESENCE_INTERVAL_MS, 10_000),
    dwellFraction: parseFloatNumber(process.env.PRESENCE_REQUIRED_DWELL_FRACTION, 0.9)
  },
  msal: {
    clientId: process.env.MSAL_CLIENT_ID ?? null,
    tenantId: process.env.MSAL_TENANT_ID ?? null,
    authority,
    jwksUri: jwksUriOverride ?? (authority ? `${authority}/discovery/v2.0/keys` : null),
    apiAudience,
    requiredScope: {
      full: requiredScopeFull,
      name: requiredScopeName
    }
  },
  world: {
    key: process.env.WORLD_KEY ?? 'default',
    boundaryPolicy: 'hard-edge'
  }
};

export const isProduction = env.nodeEnv === 'production';
