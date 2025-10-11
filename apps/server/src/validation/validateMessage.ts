import { envelopeSchema, enforceProtocolVersion, type Envelope } from '@hexmud/protocol';
import type { z } from 'zod';

export class MessageValidationError extends Error {
  constructor(message: string, readonly issues?: unknown) {
    super(message);
    this.name = 'MessageValidationError';
  }
}

export function validateMessage(raw: unknown): {
  envelope: Envelope<unknown>;
  payload: unknown;
};
export function validateMessage<TPayload>(raw: unknown, schema: z.ZodType<TPayload>): {
  envelope: Envelope<TPayload>;
  payload: TPayload;
};
export function validateMessage<TPayload>(raw: unknown, schema?: z.ZodType<TPayload>) {
  const envelopeResult = envelopeSchema.safeParse(raw);

  if (!envelopeResult.success) {
    throw new MessageValidationError('Invalid message envelope', envelopeResult.error.flatten());
  }

  const envelope = enforceProtocolVersion(envelopeResult.data);

  if (!schema) {
    return { envelope, payload: envelope.payload };
  }

  const payloadResult = schema.safeParse(envelope.payload);

  if (!payloadResult.success) {
    throw new MessageValidationError(
      `Invalid payload for message type "${envelope.type}"`,
      payloadResult.error.flatten()
    );
  }

  const typedEnvelope: Envelope<TPayload> = {
    ...envelope,
    payload: payloadResult.data
  };

  return {
    envelope: typedEnvelope,
    payload: payloadResult.data
  };
}
