#!/usr/bin/env tsx
/*
 * Lightweight load-test harness for exercising the placeholder room.
 * Connects a configurable number of concurrent Colyseus clients,
 * records join latency, sends a heartbeat, then disconnects.
 */
import { performance } from 'node:perf_hooks';
import process from 'node:process';

import { createEnvelope, PROTOCOL_VERSION } from '@hexmud/protocol';
import { Client } from 'colyseus.js';
// @ts-ignore - runtime dependency resolved from server workspace
import { Pool } from 'pg';

const SCENARIOS = ['placeholder', 'presence-increment', 'presence-decay'] as const;
type LoadTestScenario = (typeof SCENARIOS)[number];

const coerceScenario = (value?: string): LoadTestScenario =>
  SCENARIOS.includes((value ?? '') as LoadTestScenario)
    ? (value as LoadTestScenario)
    : 'placeholder';

interface CliOptions {
  serverUrl: string;
  concurrency: number;
  iterations: number;
  sessionHoldMs: number;
  heartbeatDelayMs: number;
  dryRun: boolean;
  scenario: LoadTestScenario;
  players: number;
  hexesPerPlayer: number;
  incrementsPerHex: number;
  incrementIntervalMs: number;
  databaseUrl?: string;
  presenceHexPrefix: string;
  decayIterations: number;
  decayBatchSize: number;
  dbMaxConnections: number;
}

interface SessionResult {
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

type PresenceDecayState = 'active' | 'decaying' | 'capped';

interface PlayerPresenceRecord {
  playerId: string;
  hexId: string;
  presenceValue: number;
  tierId: number;
  createdAt: Date;
  updatedAt: Date;
  lastVisitedAt: Date;
  lastIncrementAt: Date;
  decayState: PresenceDecayState;
}

interface PresenceDaoDependencies {
  pool: unknown;
  now?: () => Date;
}

interface PresenceDaoInstance {
  ensurePresenceRecord: (playerId: string, hexId: string) => Promise<PlayerPresenceRecord>;
  savePresenceRecord: (record: PlayerPresenceRecord) => Promise<PlayerPresenceRecord>;
  withTransaction: <T>(handler: (client: unknown) => Promise<T>) => Promise<T>;
}

type PresenceDaoCtor = new (dependencies: PresenceDaoDependencies) => PresenceDaoInstance;

type PresenceIncrementResult = {
  updated: PlayerPresenceRecord;
  delta: number;
  reason: 'increment' | 'cap' | 'capped';
  capped: boolean;
};

type ApplyPresenceIncrementFn = (input: {
  record: PlayerPresenceRecord;
  increment: number;
  now: Date;
}) => PresenceIncrementResult;

interface PresenceDecayEvent {
  playerId: string;
  hexId: string;
  delta: number;
  newValue: number;
  reachedFloor: boolean;
}

interface PresenceDecayBatchResult {
  processed: number;
  decayed: number;
  skipped: number;
}

type PresenceDecayProcessorInstance = {
  runBatch: () => Promise<PresenceDecayBatchResult>;
};

type PresenceDecayProcessorCtor = new (options: {
  presenceDao: PresenceDaoInstance;
  batchSize?: number;
  now?: () => Date;
  onDecay?: (event: PresenceDecayEvent) => void | Promise<void>;
}) => PresenceDecayProcessorInstance;

type PresenceModules = {
  PresenceDao: PresenceDaoCtor;
  applyPresenceIncrement: ApplyPresenceIncrementFn;
  PresenceDecayProcessor: PresenceDecayProcessorCtor;
};

let cachedPresenceModules: PresenceModules | null = null;

const loadPresenceModules = async (): Promise<PresenceModules> => {
  if (cachedPresenceModules) {
    return cachedPresenceModules;
  }

  const [daoModule, lifecycleModule, processorModule] = await Promise.all([
    // @ts-ignore - runtime dependency resolved from server workspace
    import('../apps/server/src/state/presenceDao.js'),
    // @ts-ignore - runtime dependency resolved from server workspace
    import('../apps/server/src/state/presenceLifecycle.js'),
    // @ts-ignore - runtime dependency resolved from server workspace
    import('../apps/server/src/state/presenceDecayProcessor.js')
  ]);

  const modules: PresenceModules = {
    PresenceDao: (daoModule as unknown as { PresenceDao: PresenceDaoCtor }).PresenceDao,
    applyPresenceIncrement: (lifecycleModule as unknown as { applyPresenceIncrement: ApplyPresenceIncrementFn }).applyPresenceIncrement,
    PresenceDecayProcessor: (processorModule as unknown as { PresenceDecayProcessor: PresenceDecayProcessorCtor }).PresenceDecayProcessor
  };

  cachedPresenceModules = modules;
  return modules;
};

const percentile = (values: number[], p: number): number => {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index] ?? sorted[sorted.length - 1] ?? 0;
};

const DEFAULTS: CliOptions = {
  serverUrl: process.env.LOADTEST_SERVER_URL ?? 'ws://127.0.0.1:2567',
  concurrency: Number.parseInt(process.env.LOADTEST_CONCURRENCY ?? '100', 10),
  iterations: Number.parseInt(process.env.LOADTEST_ITERATIONS ?? '1', 10),
  sessionHoldMs: Number.parseInt(process.env.LOADTEST_SESSION_MS ?? '2000', 10),
  heartbeatDelayMs: Number.parseInt(process.env.LOADTEST_HEARTBEAT_DELAY_MS ?? '1000', 10),
  dryRun: process.env.LOADTEST_DRY_RUN === 'true',
  scenario: coerceScenario(process.env.LOADTEST_SCENARIO),
  players: Number.parseInt(process.env.LOADTEST_PLAYERS ?? '1000', 10),
  hexesPerPlayer: Number.parseInt(process.env.LOADTEST_HEXES_PER_PLAYER ?? '10', 10),
  incrementsPerHex: Number.parseInt(process.env.LOADTEST_INCREMENTS_PER_HEX ?? '5', 10),
  incrementIntervalMs: Number.parseInt(process.env.LOADTEST_INCREMENT_INTERVAL_MS ?? '10000', 10),
  databaseUrl: process.env.LOADTEST_DATABASE_URL ?? process.env.DATABASE_URL,
  presenceHexPrefix: process.env.LOADTEST_HEX_PREFIX ?? 'hex',
  decayIterations: Number.parseInt(process.env.LOADTEST_DECAY_ITERATIONS ?? '5', 10),
  decayBatchSize: Number.parseInt(process.env.LOADTEST_DECAY_BATCH_SIZE ?? '5000', 10),
  dbMaxConnections: Number.parseInt(process.env.LOADTEST_DB_MAX_CONNECTIONS ?? '16', 10)
};

const parseArgs = (): CliOptions => {
  const options: CliOptions = { ...DEFAULTS };

  for (let i = 2; i < process.argv.length; i += 1) {
    const arg = process.argv[i];
    const next = process.argv[i + 1];

    switch (arg) {
      case '--server-url':
      case '-u':
        if (next) {
          options.serverUrl = next;
          i += 1;
        }
        break;
      case '--concurrency':
      case '-c':
        if (next) {
          options.concurrency = Number.parseInt(next, 10);
          i += 1;
        }
        break;
      case '--iterations':
      case '-n':
        if (next) {
          options.iterations = Number.parseInt(next, 10);
          i += 1;
        }
        break;
      case '--session-ms':
        if (next) {
          options.sessionHoldMs = Number.parseInt(next, 10);
          i += 1;
        }
        break;
      case '--heartbeat-delay-ms':
        if (next) {
          options.heartbeatDelayMs = Number.parseInt(next, 10);
          i += 1;
        }
        break;
      case '--scenario':
      case '-s':
        if (next) {
          options.scenario = coerceScenario(next);
          i += 1;
        }
        break;
      case '--players':
        if (next) {
          options.players = Number.parseInt(next, 10);
          i += 1;
        }
        break;
      case '--hexes-per-player':
        if (next) {
          options.hexesPerPlayer = Number.parseInt(next, 10);
          i += 1;
        }
        break;
      case '--increments-per-hex':
        if (next) {
          options.incrementsPerHex = Number.parseInt(next, 10);
          i += 1;
        }
        break;
      case '--increment-interval-ms':
        if (next) {
          options.incrementIntervalMs = Number.parseInt(next, 10);
          i += 1;
        }
        break;
      case '--database-url':
        if (next) {
          options.databaseUrl = next;
          i += 1;
        }
        break;
      case '--hex-prefix':
        if (next) {
          options.presenceHexPrefix = next;
          i += 1;
        }
        break;
      case '--decay-iterations':
        if (next) {
          options.decayIterations = Number.parseInt(next, 10);
          i += 1;
        }
        break;
      case '--decay-batch-size':
        if (next) {
          options.decayBatchSize = Number.parseInt(next, 10);
          i += 1;
        }
        break;
      case '--db-max-connections':
        if (next) {
          options.dbMaxConnections = Number.parseInt(next, 10);
          i += 1;
        }
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      default:
        break;
    }
  }

  options.concurrency = Number.isFinite(options.concurrency) && options.concurrency > 0
    ? options.concurrency
    : DEFAULTS.concurrency;

  options.iterations = Number.isFinite(options.iterations) && options.iterations > 0
    ? options.iterations
    : DEFAULTS.iterations;

  options.sessionHoldMs = Number.isFinite(options.sessionHoldMs) && options.sessionHoldMs >= 0
    ? options.sessionHoldMs
    : DEFAULTS.sessionHoldMs;

  options.heartbeatDelayMs = Number.isFinite(options.heartbeatDelayMs) && options.heartbeatDelayMs >= 0
    ? options.heartbeatDelayMs
    : DEFAULTS.heartbeatDelayMs;

  options.players = Number.isFinite(options.players) && options.players > 0
    ? Math.floor(options.players)
    : DEFAULTS.players;

  options.hexesPerPlayer = Number.isFinite(options.hexesPerPlayer) && options.hexesPerPlayer > 0
    ? Math.floor(options.hexesPerPlayer)
    : DEFAULTS.hexesPerPlayer;

  options.incrementsPerHex = Number.isFinite(options.incrementsPerHex) && options.incrementsPerHex > 0
    ? Math.floor(options.incrementsPerHex)
    : DEFAULTS.incrementsPerHex;

  options.incrementIntervalMs = Number.isFinite(options.incrementIntervalMs) && options.incrementIntervalMs >= 0
    ? options.incrementIntervalMs
    : DEFAULTS.incrementIntervalMs;

  options.decayIterations = Number.isFinite(options.decayIterations) && options.decayIterations > 0
    ? Math.floor(options.decayIterations)
    : DEFAULTS.decayIterations;

  options.decayBatchSize = Number.isFinite(options.decayBatchSize) && options.decayBatchSize > 0
    ? Math.floor(options.decayBatchSize)
    : DEFAULTS.decayBatchSize;

  options.dbMaxConnections = Number.isFinite(options.dbMaxConnections) && options.dbMaxConnections > 0
    ? Math.floor(options.dbMaxConnections)
    : DEFAULTS.dbMaxConnections;

  options.databaseUrl = options.databaseUrl?.trim() ? options.databaseUrl : DEFAULTS.databaseUrl;
  options.presenceHexPrefix = options.presenceHexPrefix.trim() || DEFAULTS.presenceHexPrefix;

  return options;
};

const wait = (ms: number): Promise<void> => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const closeClient = (client: Client): void => {
  const rawConnection = (client as unknown as { connection?: WebSocket }).connection;
  if (rawConnection && typeof rawConnection.close === 'function') {
    rawConnection.close();
  }
  const closable = client as unknown as { close?: () => void };
  if (typeof closable.close === 'function') {
    closable.close();
  }
};

const runWithConcurrency = async <T>(factories: Array<() => Promise<T>>, limit: number): Promise<T[]> => {
  if (factories.length === 0) {
    return [];
  }

  const results: T[] = new Array(factories.length);
  let index = 0;
  const workerCount = Math.max(1, Math.min(limit, factories.length));

  const worker = async () => {
    while (true) {
      const currentIndex = index;
      index += 1;
      if (currentIndex >= factories.length) {
        break;
      }
      try {
        results[currentIndex] = await factories[currentIndex]!();
      } catch (error) {
        throw error;
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
};

const runSession = async (serverUrl: string, heartbeatDelayMs: number, sessionHoldMs: number): Promise<SessionResult> => {
  const client = new Client(serverUrl);
  const started = performance.now();
  let latencyMs: number | undefined;

  try {
    const room = await client.joinOrCreate('placeholder', {
      protocolVersion: PROTOCOL_VERSION
    });
    latencyMs = performance.now() - started;

    if (heartbeatDelayMs > 0) {
      await wait(heartbeatDelayMs);
      room.send('envelope', createEnvelope('heartbeat', {}));
    }

    if (sessionHoldMs > 0) {
      await wait(sessionHoldMs);
    }

    await room.leave(true);
    closeClient(client);

    return { ok: true, latencyMs };
  } catch (error) {
    closeClient(client);
    return {
      ok: false,
      latencyMs,
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

const runWorker = async (
  workerId: number,
  options: CliOptions,
  record: (result: SessionResult) => void
): Promise<void> => {
  for (let iteration = 0; iteration < options.iterations; iteration += 1) {
    const result = await runSession(options.serverUrl, options.heartbeatDelayMs, options.sessionHoldMs);
    record(result);
    if (!result.ok) {
      console.error(`Worker ${workerId} iteration ${iteration} failed: ${result.error ?? 'unknown error'}`);
    }
  }
};

interface IncrementSimulationResult {
  attempts: number;
  applied: number;
  durationMs: number;
  capped: boolean;
  error?: string;
}

interface DecayBatchRun {
  processed: number;
  decayed: number;
  skipped: number;
  durationMs: number;
  emittedEvents: number;
  iteration: number;
  error?: string;
}

const summarizeResults = (results: SessionResult[]): void => {
  const successes = results.filter((result) => result.ok);
  const failures = results.length - successes.length;
  const latencies = successes.map((result) => result.latencyMs ?? 0);

  console.log('\n==== Load Test Summary ====');
  console.log(`Sessions attempted: ${results.length}`);
  console.log(`✅ Successes: ${successes.length}`);
  console.log(`❌ Failures: ${failures}`);

  if (latencies.length > 0) {
    const total = latencies.reduce((sum, value) => sum + value, 0);
    const avg = total / latencies.length;
    console.log(`Join latency (ms): p50=${percentile(latencies, 50).toFixed(2)} p95=${percentile(latencies, 95).toFixed(2)} avg=${avg.toFixed(2)}`);
  }

  if (failures > 0) {
    process.exitCode = 1;
  }
};

const runPlaceholderScenario = async (options: CliOptions): Promise<void> => {
  console.log('Starting placeholder load test with configuration:');
  console.log(JSON.stringify({
    serverUrl: options.serverUrl,
    concurrency: options.concurrency,
    iterations: options.iterations,
    sessionHoldMs: options.sessionHoldMs,
    heartbeatDelayMs: options.heartbeatDelayMs
  }, null, 2));

  const results: SessionResult[] = [];
  const record = (result: SessionResult) => {
    results.push(result);
  };

  const workers = Array.from({ length: options.concurrency }, (_, workerId) =>
    runWorker(workerId, options, record)
  );

  await Promise.allSettled(workers);
  summarizeResults(results);
};

const runPresenceIncrementScenario = async (options: CliOptions): Promise<void> => {
  const databaseUrl = options.databaseUrl;
  if (!databaseUrl) {
    console.error('Presence increment scenario requires DATABASE_URL or LOADTEST_DATABASE_URL.');
    process.exitCode = 1;
    return;
  }

  console.log('Starting presence increment load test with configuration:');
  console.log(JSON.stringify({
    players: options.players,
    hexesPerPlayer: options.hexesPerPlayer,
    incrementsPerHex: options.incrementsPerHex,
    incrementIntervalMs: options.incrementIntervalMs,
    concurrency: options.concurrency,
    dbMaxConnections: options.dbMaxConnections,
    databaseUrlProvided: Boolean(databaseUrl),
    presenceHexPrefix: options.presenceHexPrefix
  }, null, 2));

  const { PresenceDao, applyPresenceIncrement } = await loadPresenceModules();

  const pool = new Pool({
    connectionString: databaseUrl,
    max: Math.max(1, options.dbMaxConnections)
  });

  const presenceDao = new PresenceDao({
    pool,
    now: () => new Date()
  });

  const factories: Array<() => Promise<IncrementSimulationResult>> = [];
  const baseTimestamp = Date.now();

  for (let playerIndex = 0; playerIndex < options.players; playerIndex += 1) {
    const playerId = `player-${String(playerIndex).padStart(6, '0')}`;
    for (let hexIndex = 0; hexIndex < options.hexesPerPlayer; hexIndex += 1) {
      const hexId = `${options.presenceHexPrefix}:${playerIndex}:${hexIndex}`;

      factories.push(async () => {
        let currentTime = baseTimestamp;
        const interval = Math.max(1, options.incrementIntervalMs);
        let record = await presenceDao.ensurePresenceRecord(playerId, hexId);
        let applied = 0;
        let capped = false;
        let error: string | undefined;
        const start = performance.now();

        try {
          for (let attempt = 0; attempt < options.incrementsPerHex; attempt += 1) {
            currentTime += interval;
            const now = new Date(currentTime);
            const result = applyPresenceIncrement({
              record,
              increment: 1,
              now
            });

            if (result.delta === 0 && result.reason === 'capped') {
              capped = true;
              break;
            }

            record = await presenceDao.savePresenceRecord(result.updated);
            if (result.delta > 0) {
              applied += result.delta;
            }

            if (result.capped) {
              capped = true;
              break;
            }
          }
        } catch (err) {
          error = err instanceof Error ? err.message : String(err);
        }

        const durationMs = performance.now() - start;
        return {
          attempts: options.incrementsPerHex,
          applied,
          durationMs,
          capped,
          error
        } satisfies IncrementSimulationResult;
      });
    }
  }

  let simulationError: string | undefined;
  let results: IncrementSimulationResult[] = [];

  try {
    results = await runWithConcurrency(factories, options.concurrency);
  } catch (error) {
    simulationError = error instanceof Error ? error.message : String(error);
  } finally {
    await pool.end();
  }

  if (simulationError) {
    process.exitCode = 1;
    console.error('Presence increment simulation failed:', simulationError);
    return;
  }

  const totalAttempts = results.reduce((sum, entry) => sum + entry.attempts, 0);
  const totalApplied = results.reduce((sum, entry) => sum + entry.applied, 0);
  const cappedCount = results.filter((entry) => entry.capped).length;
  const durations = results.map((entry) => entry.durationMs);
  const errors = results.filter((entry) => entry.error);

  const expectedIncrements = options.players * options.hexesPerPlayer * options.incrementsPerHex;
  const variance = expectedIncrements > 0
    ? (expectedIncrements - totalApplied) / expectedIncrements
    : 0;

  console.log('\n==== Presence Increment Summary ====');
  console.log(`Records targeted: ${options.players * options.hexesPerPlayer}`);
  console.log(`Total attempts: ${totalAttempts}`);
  console.log(`Applied increments: ${totalApplied}`);
  console.log(`Capped records: ${cappedCount}`);
  console.log(`Variance vs expected: ${(variance * 100).toFixed(2)}%`);

  if (durations.length > 0) {
    const avgDuration = durations.reduce((sum, value) => sum + value, 0) / durations.length;
    console.log(`Simulation duration per record (ms): p50=${percentile(durations, 50).toFixed(2)} p95=${percentile(durations, 95).toFixed(2)} avg=${avgDuration.toFixed(2)}`);
  }

  if (errors.length > 0) {
    process.exitCode = 1;
    console.error(`Encountered ${errors.length} errors during simulation.`);
    for (const entry of errors.slice(0, 5)) {
      console.error(' -', entry.error);
    }
  }
};

const runPresenceDecayScenario = async (options: CliOptions): Promise<void> => {
  const databaseUrl = options.databaseUrl;
  if (!databaseUrl) {
    console.error('Presence decay scenario requires DATABASE_URL or LOADTEST_DATABASE_URL.');
    process.exitCode = 1;
    return;
  }

  console.log('Starting presence decay load test with configuration:');
  console.log(JSON.stringify({
    decayIterations: options.decayIterations,
    decayBatchSize: options.decayBatchSize,
    dbMaxConnections: options.dbMaxConnections,
    databaseUrlProvided: Boolean(databaseUrl)
  }, null, 2));

  const { PresenceDao, PresenceDecayProcessor } = await loadPresenceModules();

  const pool = new Pool({
    connectionString: databaseUrl,
    max: Math.max(1, options.dbMaxConnections)
  });

  const presenceDao = new PresenceDao({
    pool,
    now: () => new Date()
  });

  let decayEvents = 0;
  const processor = new PresenceDecayProcessor({
    presenceDao,
    batchSize: options.decayBatchSize,
    now: () => new Date(),
    onDecay: () => {
      decayEvents += 1;
    }
  });

  const runs: DecayBatchRun[] = [];

  try {
    for (let iteration = 0; iteration < options.decayIterations; iteration += 1) {
      const start = performance.now();
      let error: string | undefined;
      let processed = 0;
      let decayed = 0;
      let skipped = 0;
      const eventsBefore = decayEvents;

      try {
        const result = await processor.runBatch();
        processed = result.processed;
        decayed = result.decayed;
        skipped = result.skipped;
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
        process.exitCode = 1;
      }

      const durationMs = performance.now() - start;

      runs.push({
        processed,
        decayed,
        skipped,
        durationMs,
        emittedEvents: decayEvents - eventsBefore,
        iteration,
        error
      });

      if (processed === 0) {
        break;
      }
    }
  } finally {
    await pool.end();
  }

  const totalProcessed = runs.reduce((sum, entry) => sum + entry.processed, 0);
  const totalDecayed = runs.reduce((sum, entry) => sum + entry.decayed, 0);
  const totalSkipped = runs.reduce((sum, entry) => sum + entry.skipped, 0);
  const durations = runs.map((entry) => entry.durationMs);
  const totalEmitted = runs.reduce((sum, entry) => sum + entry.emittedEvents, 0);

  console.log('\n==== Presence Decay Summary ====');
  console.log(`Iterations executed: ${runs.length}`);
  console.log(`Total processed: ${totalProcessed}`);
  console.log(`Decayed records: ${totalDecayed}`);
  console.log(`Skipped (floor or already fresh): ${totalSkipped}`);
  console.log(`Decay events emitted: ${totalEmitted}`);

  if (durations.length > 0) {
    const avgDuration = durations.reduce((sum, value) => sum + value, 0) / durations.length;
    console.log(`Batch duration (ms): p50=${percentile(durations, 50).toFixed(2)} p95=${percentile(durations, 95).toFixed(2)} avg=${avgDuration.toFixed(2)}`);
  }

  const failures = runs.filter((entry) => entry.error);
  if (failures.length > 0) {
    process.exitCode = 1;
    console.error(`Encountered ${failures.length} decay batch errors.`);
    for (const failure of failures.slice(0, 5)) {
      console.error(` - iteration ${failure.iteration}: ${failure.error}`);
    }
  }
};

const main = async (): Promise<void> => {
  const options = parseArgs();

  if (options.dryRun) {
    console.log('Dry run - load test configuration:');
    console.log(JSON.stringify({
      scenario: options.scenario,
      serverUrl: options.serverUrl,
      concurrency: options.concurrency,
      iterations: options.iterations,
      sessionHoldMs: options.sessionHoldMs,
      heartbeatDelayMs: options.heartbeatDelayMs,
      players: options.players,
      hexesPerPlayer: options.hexesPerPlayer,
      incrementsPerHex: options.incrementsPerHex,
      incrementIntervalMs: options.incrementIntervalMs,
      databaseUrlProvided: Boolean(options.databaseUrl),
      presenceHexPrefix: options.presenceHexPrefix,
      decayIterations: options.decayIterations,
      decayBatchSize: options.decayBatchSize,
      dbMaxConnections: options.dbMaxConnections
    }, null, 2));
    return;
  }

  switch (options.scenario) {
    case 'presence-increment':
      await runPresenceIncrementScenario(options);
      break;
    case 'presence-decay':
      await runPresenceDecayScenario(options);
      break;
    case 'placeholder':
    default:
      await runPlaceholderScenario(options);
      break;
  }
};

main().catch((error) => {
  console.error('Load test failed to execute:', error instanceof Error ? error.message : error);
  process.exit(1);
});
