import { AsyncLocalStorage } from 'node:async_hooks';

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
  ...includeCorrelationId(context)
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
