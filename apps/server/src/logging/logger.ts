import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';

import { env, type LogLevel } from '../config/env.js';

type LogContext = Record<string, unknown> | undefined;

type LoggerMethod = (message: string, context?: LogContext) => void;

interface Logger {
  trace: LoggerMethod;
  debug: LoggerMethod;
  info: LoggerMethod;
  warn: LoggerMethod;
  error: LoggerMethod;
}

const levelOrder: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  silent: 100
};

const correlationStore = new AsyncLocalStorage<string | null>();

const getCorrelationId = (): string | null => correlationStore.getStore() ?? null;

const SENSITIVE_KEY_PATTERNS = ['token', 'secret', 'password', 'authorization', 'cookie'];
const MAX_STRING_LENGTH = 256;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const hashEmail = (value: string): string => {
  const hash = createHash('sha256').update(value).digest('hex').slice(0, 16);
  return `email_hash:${hash}`;
};

const sanitizeValue = (value: unknown, keyHint: string): unknown => {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry, index) => sanitizeValue(entry, `${keyHint}[${index}]`));
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    return entries.reduce<Record<string, unknown>>((acc, [key, entry]) => {
      acc[key] = sanitizeValue(entry, key);
      return acc;
    }, {});
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  const normalizedKey = keyHint.toLowerCase();

  if (SENSITIVE_KEY_PATTERNS.some((pattern) => normalizedKey.includes(pattern))) {
    return '[REDACTED]';
  }

  if (EMAIL_REGEX.test(trimmed)) {
    return hashEmail(trimmed);
  }

  if (trimmed.length > MAX_STRING_LENGTH) {
    const visible = trimmed.slice(0, MAX_STRING_LENGTH);
    const truncated = trimmed.length - MAX_STRING_LENGTH;
    return `${visible}…[truncated ${truncated} chars]`;
  }

  return trimmed;
};

const sanitizeContext = (context: LogContext): LogContext => {
  if (!context) {
    return context;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    sanitized[key] = sanitizeValue(value, key);
  }
  return sanitized;
};

const includeCorrelationId = (context: LogContext): LogContext => {
  const correlationId = getCorrelationId();
  if (!correlationId) {
    return context;
  }
  return {
    ...context,
    correlationId
  };
};

const shouldLog = (level: LogLevel): boolean => levelOrder[level] >= levelOrder[env.logLevel];

const formatPayload = (level: LogLevel, message: string, context?: LogContext) => ({
  level,
  message,
  timestamp: new Date().toISOString(),
  ...includeCorrelationId(sanitizeContext(context))
});

const logWithConsole = (level: LogLevel, message: string, context?: LogContext): void => {
  if (!shouldLog(level)) {
    return;
  }

  const payload = formatPayload(level, message, context);
  const output = JSON.stringify(payload);

  if (level === 'error') {
    console.error(output);
  } else if (level === 'warn') {
    console.warn(output);
  } else {
    console.log(output);
  }
};

export const logger: Logger = {
  trace: (message, context) => logWithConsole('trace', message, context),
  debug: (message, context) => logWithConsole('debug', message, context),
  info: (message, context) => logWithConsole('info', message, context),
  warn: (message, context) => logWithConsole('warn', message, context),
  error: (message, context) => logWithConsole('error', message, context)
};

export type { Logger };

export interface WorldVersionLogContext {
  worldKey: string;
  version: number | string;
  regionCount: number;
  tileCount: number;
}

export const logWorldVersionMetadata = (context: WorldVersionLogContext): void => {
  const numericVersion = typeof context.version === 'number' ? context.version : Number(context.version);
  const versionIsNumeric = Number.isFinite(numericVersion);

  logger.info('world.default.version.active', {
    worldKey: context.worldKey,
    version: context.version,
    regionCount: context.regionCount,
    tileCount: context.tileCount,
    versionIsNumeric,
    numericVersion: versionIsNumeric ? numericVersion : undefined
  });

  if (!versionIsNumeric) {
    logger.warn('world.default.version.invalid', {
      worldKey: context.worldKey,
      rawVersion: context.version
    });
  }
};

export const loggingContext = {
  withCorrelationId: async <T>(correlationId: string, fn: () => Promise<T> | T): Promise<T> =>
    correlationStore.run(correlationId, () => Promise.resolve(fn())),
  setCorrelationId: (correlationId: string) => {
    correlationStore.enterWith(correlationId);
  },
  clearCorrelationId: () => {
    correlationStore.enterWith(null);
  },
  getCorrelationId
};
