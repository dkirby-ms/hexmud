#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(rootDir, '..');
const versionFilePath = path.join(workspaceRoot, 'packages/protocol/src/version.ts');
const changelogPath = path.join(workspaceRoot, 'packages/protocol/CHANGELOG.md');

const header = '# Protocol Changelog';

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const parseVersionArgument = (): number => {
  const raw = process.argv[2];
  if (!raw) {
    fail('Usage: pnpm dlx tsx scripts/bump-protocol-version.ts <next-version>');
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    fail(`Invalid protocol version "${raw}". Expected a positive integer.`);
  }
  return parsed;
};

const readVersionFile = async () => {
  const source = await readFile(versionFilePath, 'utf8');
  const match = source.match(/PROTOCOL_VERSION\s*=\s*(\d+)/) ?? fail(
    `Unable to find PROTOCOL_VERSION assignment in ${versionFilePath}`
  );
  const currentVersion = Number.parseInt(match[1], 10);
  return { source, currentVersion };
};

const formatUpdatedVersionSource = (source: string, nextVersion: number): string =>
  source.replace(/PROTOCOL_VERSION\s*=\s*\d+/, `PROTOCOL_VERSION = ${nextVersion}`);

const buildChangelogEntry = (nextVersion: number): string => {
  const timestamp = new Date().toISOString().slice(0, 10);
  return `## v${nextVersion} - ${timestamp}\n- Bumped PROTOCOL_VERSION to ${nextVersion}.\n`;
};

const updateChangelog = async (entry: string): Promise<void> => {
  let changelogContent = '';
  try {
    changelogContent = await readFile(changelogPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  if (!changelogContent.trim()) {
    changelogContent = `${header}\n\n`;
  }

  if (!changelogContent.startsWith(header)) {
    changelogContent = `${header}\n\n${changelogContent.trim()}\n`;
  }

  const existingEntries = changelogContent.slice(header.length).trimStart();
  const updated = `${header}\n\n${entry}\n${existingEntries}`.replace(/\n{3,}/g, '\n\n');

  await writeFile(changelogPath, `${updated.trimEnd()}\n`, 'utf8');
};

const promptConfirmation = async (currentVersion: number, nextVersion: number): Promise<void> => {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(
      `Confirm bump protocol version from ${currentVersion} to ${nextVersion}? (y/N) `
    );
    if (!/^y(es)?$/i.test(answer.trim())) {
      fail('Aborted by user.');
    }
  } finally {
    rl.close();
  }
};

const main = async () => {
  const nextVersion = parseVersionArgument();
  const { source, currentVersion } = await readVersionFile();

  if (nextVersion <= currentVersion) {
    fail(`Next version (${nextVersion}) must be greater than current version (${currentVersion}).`);
  }

  await promptConfirmation(currentVersion, nextVersion);

  const updatedSource = formatUpdatedVersionSource(source, nextVersion);
  await writeFile(versionFilePath, updatedSource, 'utf8');

  const entry = buildChangelogEntry(nextVersion);
  await updateChangelog(entry);
  console.log(`Protocol version bumped to v${nextVersion}.`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
