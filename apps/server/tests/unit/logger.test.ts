import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger, loggingContext } from '../../src/logging/logger.js';

describe('logger correlation id support', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('includes correlationId when set via context helper', async () => {
    await loggingContext.withCorrelationId('corr-123', () => {
      logger.info('test.event', { value: 42 });
    });

    expect(logSpy).toHaveBeenCalled();
  const firstCall = logSpy.mock.calls[0];
  expect(firstCall).toBeDefined();
  const payload = JSON.parse(firstCall![0] as string);
    expect(payload).toMatchObject({
      message: 'test.event',
      correlationId: 'corr-123',
      value: 42
    });
  });

  it('omits correlationId when not set', () => {
    logSpy.mockClear();

    logger.info('plain.event');

    expect(logSpy).toHaveBeenCalled();
  const firstCall = logSpy.mock.calls[0];
  expect(firstCall).toBeDefined();
  const payload = JSON.parse(firstCall![0] as string);
    expect(payload).not.toHaveProperty('correlationId');
  });

  it('hashes email values and redacts sensitive keys', () => {
    logSpy.mockClear();

    logger.info('auth.event', {
      username: 'player@example.com',
      accessToken: 'very-secret-token',
      nested: {
        refreshToken: 'another-secret'
      }
    });

    expect(logSpy).toHaveBeenCalled();
    const [firstCall] = logSpy.mock.calls;
    expect(firstCall).toBeDefined();
    const payload = JSON.parse(firstCall![0] as string);

    expect(payload.username).toMatch(/^email_hash:[0-9a-f]{16}$/);
    expect(payload.accessToken).toBe('[REDACTED]');
    expect(payload.nested.refreshToken).toBe('[REDACTED]');
  });

  it('truncates oversized string values', () => {
    logSpy.mockClear();
    const longValue = 'a'.repeat(300);

    logger.info('long.event', { notes: longValue });

    expect(logSpy).toHaveBeenCalled();
    const [firstCall] = logSpy.mock.calls;
    expect(firstCall).toBeDefined();
    const payload = JSON.parse(firstCall![0] as string);

    expect(payload.notes).toMatch(/…\[truncated 44 chars]$/);
    expect(payload.notes).not.toContain(longValue);
  });
});
