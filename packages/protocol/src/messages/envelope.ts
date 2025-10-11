import { z } from 'zod';

import { PROTOCOL_VERSION } from '../version';

interface EnvelopeLike {
  type: string;
  v: number;
  ts: number;
  payload?: unknown;
}

export const envelopeSchema = z
  .object({
    type: z.string().min(1, 'Message type is required'),
    v: z.number().int().nonnegative(),
    ts: z.number().int(),
    payload: z.unknown()
  })
  .strict();

export type Envelope<TPayload = unknown> = EnvelopeLike & { payload: TPayload };

export const enforceProtocolVersion = <TPayload>(value: Envelope<TPayload>): Envelope<TPayload> => {
  if (value.v !== PROTOCOL_VERSION) {
    throw new Error(
      `Protocol version mismatch: expected ${PROTOCOL_VERSION}, received ${value.v}`
    );
  }
  return value;
};

export const createEnvelope = <TPayload>(
  type: string,
  payload: TPayload,
  options?: {
    timestamp?: number;
    version?: number;
  }
): Envelope<TPayload> => ({
  type,
  v: options?.version ?? PROTOCOL_VERSION,
  ts: options?.timestamp ?? Date.now(),
  payload
});

export const makeTypedEnvelopeSchema = <TSchema extends z.ZodTypeAny>(
  type: string,
  schema: TSchema
) =>
  envelopeSchema
    .extend({
      type: z.literal(type),
      payload: schema
    })
    .refine((value) => value.v === PROTOCOL_VERSION, {
      message: `Envelope version must equal ${PROTOCOL_VERSION}`
    });
