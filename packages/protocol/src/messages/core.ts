import { z } from 'zod';

import { PROTOCOL_VERSION } from '../version';

import { makeTypedEnvelopeSchema } from './envelope';

export const heartbeatPayloadSchema = z.object({}).strict();
export type HeartbeatPayload = z.infer<typeof heartbeatPayloadSchema>;

export const sessionWelcomePayloadSchema = z
  .object({
    sessionId: z.string().min(1),
    playerId: z.string().min(1),
    protocolVersion: z.literal(PROTOCOL_VERSION),
    build: z.number().int().nonnegative()
  })
  .strict();
export type SessionWelcomePayload = z.infer<typeof sessionWelcomePayloadSchema>;

export const errorCodeSchema = z.enum(['AUTH_REQUIRED', 'VERSION_MISMATCH', 'RATE_LIMIT', 'INTERNAL_ERROR']);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const errorPayloadSchema = z
  .object({
    code: errorCodeSchema,
    message: z.string().min(1)
  })
  .strict();
export type ErrorPayload = z.infer<typeof errorPayloadSchema>;

export const heartbeatMessageSchema = makeTypedEnvelopeSchema('heartbeat', heartbeatPayloadSchema);
export type HeartbeatMessage = z.infer<typeof heartbeatMessageSchema>;

export const sessionWelcomeMessageSchema = makeTypedEnvelopeSchema(
  'session.welcome',
  sessionWelcomePayloadSchema
);
export type SessionWelcomeMessage = z.infer<typeof sessionWelcomeMessageSchema>;

export const errorMessageSchema = makeTypedEnvelopeSchema('error', errorPayloadSchema);
export type ErrorMessage = z.infer<typeof errorMessageSchema>;
