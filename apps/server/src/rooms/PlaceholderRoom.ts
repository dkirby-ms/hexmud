import { createEnvelope, errorCodeSchema, heartbeatPayloadSchema } from '@hexmud/protocol';
import type { Client } from 'colyseus';
import { Room } from 'colyseus';

import { env } from '../config/env.js';
import {
  JoinRejectedError,
  processJoinRequest,
  type JoinOptions
} from '../handlers/join.js';
import { logger, loggingContext } from '../logging/logger.js';
import { HeartbeatRateLimiter } from '../ratelimit/heartbeat.js';
import { rooms } from '../state/rooms.js';
import { sessions } from '../state/sessions.js';
import type { MessageValidationError } from '../validation/validateMessage.js';
import { validateMessage } from '../validation/validateMessage.js';

const ROOM_MESSAGE = 'The placeholder world hums quietly.';

export class PlaceholderRoom extends Room {
  private broadcastIntervalId: ReturnType<typeof setInterval> | null = null;
  private readonly heartbeatLimiter = new HeartbeatRateLimiter(env.heartbeatRateLimit);

  override onCreate(): void {
    rooms.ensure(this.roomId, env.protocolVersion);

    this.broadcastState();
    this.broadcastIntervalId = setInterval(() => this.broadcastState(), env.heartbeatIntervalMs);

    this.onMessage('envelope', (client, raw) => {
      try {
  const validated = validateMessage(raw);
  const envelope = validated.envelope;
  const payload = validated.payload;

        if (envelope.type === 'heartbeat') {
          if (!this.heartbeatLimiter.consume(client.sessionId)) {
            client.send(
              'envelope',
              createEnvelope('error', {
                code: errorCodeSchema.enum.RATE_LIMIT,
                message: 'RATE_LIMIT: heartbeat frequency exceeded'
              })
            );
            return;
          }
          heartbeatPayloadSchema.parse(payload);
          sessions.updateSession(client.sessionId, { lastHeartbeatAt: new Date() });
          client.send('envelope', createEnvelope('heartbeat', {}));
          return;
        }

        client.send(
          'envelope',
          createEnvelope('error', {
            code: errorCodeSchema.enum.INTERNAL_ERROR,
            message: `Unhandled message type: ${envelope.type}`
          })
        );
      } catch (error) {
        const validationError = error as MessageValidationError | Error;
        loggingContext.setCorrelationId(client.sessionId);
        try {
          logger.warn('room.placeholder.invalid_message', {
            sessionId: client.sessionId,
            error: validationError instanceof Error ? validationError.message : 'unknown'
          });
        } finally {
          loggingContext.clearCorrelationId();
        }
        client.send(
          'envelope',
          createEnvelope('error', {
            code: errorCodeSchema.enum.INTERNAL_ERROR,
            message: 'Invalid message'
          })
        );
      }
    });
  }

  override onAuth(): boolean {
    return true;
  }

  override async onJoin(client: Client, options: JoinOptions): Promise<void> {
    await loggingContext.withCorrelationId(client.sessionId, async () => {
      let joinContext: Awaited<ReturnType<typeof processJoinRequest>>;

      try {
        joinContext = await processJoinRequest({
          client,
          options,
          expectedProtocolVersion: env.protocolVersion
        });
      } catch (error) {
        if (error instanceof JoinRejectedError) {
          if (error.code === 'VERSION_MISMATCH') {
            logger.warn('room.placeholder.protocol_mismatch', {
              requested: options.protocolVersion,
              expected: env.protocolVersion
            });
          } else if (error.code === 'AUTH_REQUIRED') {
            logger.warn('room.placeholder.auth_failed', {
              sessionId: client.sessionId,
              reason: error.message
            });
          }
        }
        throw error;
      }

      const now = new Date();

      if (joinContext.claims) {
        sessions.upsertIdentity({
          playerId: joinContext.playerId,
          displayName: joinContext.claims.name ?? joinContext.claims.preferred_username,
          roles: joinContext.roles,
          authClaims: joinContext.claims,
          sessionPolicy: {
            allowConcurrent: true
          }
        });
      }

      sessions.createSession({
        sessionId: client.sessionId,
        playerId: joinContext.playerId,
        connectedAt: now,
        lastHeartbeatAt: now,
        connectionState: 'active',
        protocolVersion: joinContext.protocolVersion,
        roomId: this.roomId
      });

      rooms.addSession(this.roomId, client.sessionId, env.protocolVersion);

      client.send(
        'envelope',
        createEnvelope('session.welcome', {
          sessionId: client.sessionId,
          playerId: joinContext.playerId,
          protocolVersion: joinContext.protocolVersion,
          build: env.buildNumber
        })
      );

      logger.info('room.placeholder.joined', {
        roomId: this.roomId,
        sessionId: client.sessionId,
        playerId: joinContext.playerId
      });
    });
  }

  override onLeave(client: Client): void {
    loggingContext.setCorrelationId(client.sessionId);
    try {
      sessions.removeSession(client.sessionId);
      rooms.removeSession(this.roomId, client.sessionId);
      this.heartbeatLimiter.clear(client.sessionId);

      logger.info('room.placeholder.left', {
        roomId: this.roomId,
        sessionId: client.sessionId
      });
    } finally {
      loggingContext.clearCorrelationId();
    }
  }

  override onDispose(): void {
    if (this.broadcastIntervalId) {
      clearInterval(this.broadcastIntervalId);
      this.broadcastIntervalId = null;
    }

    this.heartbeatLimiter.clearAll();

    logger.info('room.placeholder.disposed', {
      roomId: this.roomId
    });
  }

  private broadcastState(): void {
    this.broadcast(
      'envelope',
      createEnvelope('room.state', {
        roomId: this.roomId,
        snapshot: {
          message: ROOM_MESSAGE,
          updatedAt: Date.now()
        }
      })
    );
  }
}
