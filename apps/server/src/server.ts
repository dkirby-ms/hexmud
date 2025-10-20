import { createServer as createHttpServer } from 'node:http';
import process from 'node:process';

import { WebSocketTransport } from '@colyseus/ws-transport';
import { PROTOCOL_VERSION } from '@hexmud/protocol';
import { Server as ColyseusServer } from 'colyseus';
import { Pool } from 'pg';
import express, { type Request, type Response } from 'express';

import { env } from './config/env.js';
import { logger } from './logging/logger.js';
import { PlaceholderRoom } from './rooms/PlaceholderRoom.js';
import { WorldRoom } from './rooms/WorldRoom.js';
import { PresenceDao } from './state/presenceDao.js';
import { PresenceDecayProcessor } from './state/presenceDecayProcessor.js';

export const createApp = (): express.Express => {
  const app = express();

  app.get('/healthz', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      uptimeSeconds: process.uptime()
    });
  });

  app.get('/version', (_req: Request, res: Response) => {
    res.json({
      protocolVersion: PROTOCOL_VERSION
    });
  });

  return app;
};

export const createGameServer = (httpServer: ReturnType<typeof createHttpServer>): ColyseusServer =>
  new ColyseusServer({
    transport: new WebSocketTransport({ server: httpServer })
  });

type ShutdownFn = () => Promise<void>;

let registeredShutdown: ShutdownFn | null = null;

const registerSignalHandlers = (shutdown: ShutdownFn) => {
  if (registeredShutdown) {
    registeredShutdown = shutdown;
    return;
  }

  registeredShutdown = shutdown;

  const handleSignal = async (signal: NodeJS.Signals) => {
    logger.info('server.shutdown_signal', { signal });
    try {
      await registeredShutdown?.();
      process.exit(0);
    } catch (error) {
      logger.error('server.shutdown_error', {
        error: error instanceof Error ? error.message : error
      });
      process.exit(1);
    }
  };

  process.once('SIGINT', (signal) => {
    void handleSignal(signal);
  });
  process.once('SIGTERM', (signal) => {
    void handleSignal(signal);
  });
};

export const start = async (): Promise<{
  app: express.Express;
  httpServer: ReturnType<typeof createHttpServer>;
  gameServer: ColyseusServer;
  stop: ShutdownFn;
}> => {
  const app = createApp();
  const httpServer = createHttpServer(app);
  const gameServer = createGameServer(httpServer);

  gameServer.define('placeholder', PlaceholderRoom);

  let databasePool: Pool | null = null;
  let decayInterval: NodeJS.Timeout | null = null;
  let decayProcessor: PresenceDecayProcessor | null = null;
  if (env.database.url) {
    databasePool = new Pool({
      connectionString: env.database.url,
      max: env.database.maxConnections
    });

    databasePool.on('error', (error) => {
      logger.error('database.pool_error', {
        error: error instanceof Error ? error.message : error
      });
    });

    const presenceDao = new PresenceDao({
      pool: databasePool,
      now: () => new Date()
    });
    WorldRoom.configure({
      presenceDao,
      now: () => new Date()
    });
    gameServer.define('world', WorldRoom);

    decayProcessor = new PresenceDecayProcessor({
      presenceDao,
      now: () => new Date(),
      onDecay: (event) => WorldRoom.notifyDecay(event)
    });

    const decayIntervalMs = Math.max(60_000, env.presence.intervalMs);
    decayInterval = setInterval(() => {
      if (!decayProcessor) {
        return;
      }
      void decayProcessor.runBatch().catch((error) => {
        logger.error('presence.decay_batch_error', {
          error: error instanceof Error ? error.message : error
        });
      });
    }, decayIntervalMs);

    void decayProcessor.runBatch().catch((error) => {
      logger.error('presence.decay_batch_error', {
        error: error instanceof Error ? error.message : error
      });
    });
  } else {
    logger.warn('presence.disabled_database_missing', {
      reason: 'DATABASE_URL not configured'
    });
  }

  await new Promise<void>((resolve) => {
    httpServer.listen(env.port, env.host, () => resolve());
  });

  const stop: ShutdownFn = async () => {
    await new Promise<void>((resolve, reject) => {
      httpServer.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
    await gameServer.gracefullyShutdown(false);
    if (decayInterval) {
      clearInterval(decayInterval);
      decayInterval = null;
    }
    decayProcessor = null;
    await databasePool?.end();
  };

  logger.info('server.started', {
    host: env.host,
    port: env.port,
    protocolVersion: env.protocolVersion
  });

  return { app, httpServer, gameServer, stop };
};

if (import.meta.url === `file://${process.argv[1]}`) {
  start()
    .then(({ stop }) => {
      registerSignalHandlers(stop);
    })
    .catch((error) => {
      logger.error('server.start_failed', {
        error: error instanceof Error ? error.message : error
      });
      process.exit(1);
    });
}
