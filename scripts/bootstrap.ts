#!/usr/bin/env tsx
/*
 * Verifies local tooling versions and installs workspace dependencies.
 */
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const MIN_NODE_VERSION = '22.0.0';
const MIN_PNPM_VERSION = '9.0.0';

interface VersionCheckResult {
  name: string;
  current: string | null;
  minimum: string;
  ok: boolean;
  details?: string;
}

const compareSemver = (a: string, b: string): number => {
  const pa = a.split('.').map((part) => Number.parseInt(part, 10));
  const pb = b.split('.').map((part) => Number.parseInt(part, 10));
  const maxLength = Math.max(pa.length, pb.length);
  for (let i = 0; i < maxLength; i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
};

const checkNodeVersion = (): VersionCheckResult => {
  const current = process.versions.node;
  return {
    name: 'Node.js',
    current,
    minimum: MIN_NODE_VERSION,
    ok: compareSemver(current, MIN_NODE_VERSION) >= 0
  };
};

const checkPnpmVersion = (): VersionCheckResult => {
  try {
    const result = spawnSync('pnpm', ['--version'], {
      encoding: 'utf8'
    });
    if (result.error) {
      return {
        name: 'pnpm',
        current: null,
        minimum: MIN_PNPM_VERSION,
        ok: false,
        details: result.error.message
      };
    }
    const current = result.stdout.trim();
    return {
      name: 'pnpm',
      current,
      minimum: MIN_PNPM_VERSION,
      ok: compareSemver(current, MIN_PNPM_VERSION) >= 0
    };
  } catch (error) {
    return {
      name: 'pnpm',
      current: null,
      minimum: MIN_PNPM_VERSION,
      ok: false,
      details: error instanceof Error ? error.message : String(error)
    };
  }
};

const reportResult = (result: VersionCheckResult): void => {
  if (result.ok) {
    console.log(`✓ ${result.name} ${result.current} (minimum ${result.minimum})`);
  } else {
    console.error(`✗ ${result.name} check failed. Minimum required: ${result.minimum}.`);
    if (result.current) {
      console.error(`  Detected version: ${result.current}`);
    }
    if (result.details) {
      console.error(`  Details: ${result.details}`);
    }
  }
};

const run = (): void => {
  console.log('🔍 Verifying local environment...');
  const results = [checkNodeVersion(), checkPnpmVersion()];

  let hasFailure = false;
  for (const result of results) {
    reportResult(result);
    if (!result.ok) {
      hasFailure = true;
    }
  }

  if (hasFailure) {
    console.error('\nEnvironment requirements not met. Please upgrade the tools above and re-run `pnpm run bootstrap`.');
    process.exit(1);
  }

  console.log('\n✅ Environment checks passed. Installing workspace dependencies...');

  const install = spawnSync('pnpm', ['install'], {
    stdio: 'inherit'
  });

  if (install.status !== 0) {
    console.error('\nDependency installation failed. See logs above for details.');
    process.exit(install.status ?? 1);
  }

  console.log('\n🎉 Bootstrap complete! You can now run `pnpm run dev` to start the stack.');
};

run();
