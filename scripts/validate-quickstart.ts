#!/usr/bin/env tsx
/*
 * Validates that the documented quickstart workflow remains accurate.
 * Optionally replays the bootstrap + test flow to catch regressions.
 */
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

interface CliOptions {
  dryRun: boolean;
  skipInstall: boolean;
  skipTests: boolean;
}

interface Step {
  name: string;
  command: string[];
  skip?: boolean;
}

const FEATURE_DIR = path.resolve('specs/001-monorepo-framework-for');
const QUICKSTART_PATH = path.join(FEATURE_DIR, 'quickstart.md');

const parseArgs = (): CliOptions => {
  const options: CliOptions = {
    dryRun: false,
    skipInstall: false,
    skipTests: false
  };

  for (let i = 2; i < process.argv.length; i += 1) {
    const arg = process.argv[i];
    switch (arg) {
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--skip-install':
        options.skipInstall = true;
        break;
      case '--skip-tests':
        options.skipTests = true;
        break;
      default:
        console.warn(`Ignoring unknown argument: ${arg}`);
        break;
    }
  }

  return options;
};

const assertQuickstartMentions = async (): Promise<void> => {
  const content = await readFile(QUICKSTART_PATH, 'utf8');
  const requiredSnippets = [
    'pnpm run bootstrap',
    'pnpm run dev',
    'pnpm run test'
  ];

  const missing = requiredSnippets.filter((snippet) => !content.includes(snippet));
  if (missing.length > 0) {
    console.error('Quickstart documentation appears stale. Missing references:', missing.join(', '));
    process.exit(1);
  }
};

const runStep = (step: Step): void => {
  if (step.skip) {
    console.log(`↷ Skipping step: ${step.name}`);
    return;
  }

  console.log(`▶ ${step.name}`);
  const result = spawnSync(step.command[0]!, step.command.slice(1), {
    stdio: 'inherit',
    env: process.env
  });

  if (result.status !== 0) {
    console.error(`Step failed: ${step.name}`);
    process.exit(result.status ?? 1);
  }
};

const main = async (): Promise<void> => {
  const options = parseArgs();

  await assertQuickstartMentions();

  const steps: Step[] = [
    {
      name: 'Install workspace dependencies (pnpm run bootstrap)',
      command: ['pnpm', 'run', 'bootstrap'],
      skip: options.skipInstall
    },
    {
      name: 'Execute workspace tests (pnpm run test)',
      command: ['pnpm', 'run', 'test'],
      skip: options.skipTests
    }
  ];

  if (options.dryRun) {
    console.log('Dry run – planned steps:');
    for (const step of steps) {
      console.log(`- ${step.name}${step.skip ? ' (skipped)' : ''}`);
    }
    return;
  }

  for (const step of steps) {
    runStep(step);
  }

  console.log('✅ Quickstart validation completed successfully.');
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
