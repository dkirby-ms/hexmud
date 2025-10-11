import { describe, expect, it } from 'vitest';

import { PROTOCOL_VERSION } from '../src/version';

describe('PROTOCOL_VERSION', () => {
  it('is a positive integer constant', () => {
    expect(PROTOCOL_VERSION).toBeGreaterThan(0);
    expect(Number.isInteger(PROTOCOL_VERSION)).toBe(true);
  });
});
