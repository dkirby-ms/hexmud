import { readFileSync, writeFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const versionFileUrl = new URL('../src/version.ts', import.meta.url);

let originalContent: string;

describe('protocol version watch propagation', () => {
  beforeAll(() => {
    originalContent = readFileSync(versionFileUrl, 'utf8');
  });

  afterAll(() => {
    writeFileSync(versionFileUrl, originalContent, 'utf8');
  });

  it('reflects updates when the version file changes', async () => {
    const originalModule = await import('../src/version.ts');
    expect(originalModule.PROTOCOL_VERSION).toBeDefined();

    const patchedContent = originalContent.replace(
      /PROTOCOL_VERSION\s*=\s*\d+/,
      'PROTOCOL_VERSION = 999'
    );

    writeFileSync(versionFileUrl, patchedContent, 'utf8');

  vi.resetModules();

  const reloadedModule = await import(/* @vite-ignore */ `../src/version.ts?update=${Date.now()}`);

    expect(reloadedModule.PROTOCOL_VERSION).toBe(999);
  });
});
