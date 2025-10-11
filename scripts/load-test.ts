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

interface CliOptions {
  serverUrl: string;
  concurrency: number;
  iterations: number;
  sessionHoldMs: number;
  heartbeatDelayMs: number;
  dryRun: boolean;
}

interface SessionResult {
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

const DEFAULTS: CliOptions = {
  serverUrl: process.env.LOADTEST_SERVER_URL ?? 'ws://127.0.0.1:2567',
  concurrency: Number.parseInt(process.env.LOADTEST_CONCURRENCY ?? '100', 10),
  iterations: Number.parseInt(process.env.LOADTEST_ITERATIONS ?? '1', 10),
  sessionHoldMs: Number.parseInt(process.env.LOADTEST_SESSION_MS ?? '2000', 10),
  heartbeatDelayMs: Number.parseInt(process.env.LOADTEST_HEARTBEAT_DELAY_MS ?? '1000', 10),
  dryRun: process.env.LOADTEST_DRY_RUN === 'true'
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

const summarizeResults = (results: SessionResult[]): void => {
  const successes = results.filter((result) => result.ok);
  const failures = results.length - successes.length;
  const latencies = successes.map((result) => result.latencyMs ?? 0).sort((a, b) => a - b);

  const percentile = (values: number[], p: number): number => {
    if (values.length === 0) {
      return 0;
    }
    const index = Math.min(values.length - 1, Math.floor((p / 100) * values.length));
    return values[index] ?? values[values.length - 1] ?? 0;
  };

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

const main = async (): Promise<void> => {
  const options = parseArgs();

  if (options.dryRun) {
    console.log('Dry run - load test configuration:');
    console.log(JSON.stringify({
      serverUrl: options.serverUrl,
      concurrency: options.concurrency,
      iterations: options.iterations,
      sessionHoldMs: options.sessionHoldMs,
      heartbeatDelayMs: options.heartbeatDelayMs
    }, null, 2));
    return;
  }

  console.log('Starting load test with configuration:');
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

main().catch((error) => {
  console.error('Load test failed to execute:', error instanceof Error ? error.message : error);
  process.exit(1);
});
