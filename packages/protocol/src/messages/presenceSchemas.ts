import { z } from 'zod';

import { makeTypedEnvelopeSchema } from './envelope.js';

export const presenceHexIdRegex = /^[A-Za-z0-9:_-]+$/;

export const presenceHexIdSchema = z
  .string()
  .min(1)
  .regex(presenceHexIdRegex, 'Invalid hex identifier');

export const presenceTierIdSchema = z.number().int().nonnegative();

export const presenceSnapshotEntrySchema = z
  .object({
    hexId: presenceHexIdSchema,
    value: z.number().int().positive(),
    tierId: presenceTierIdSchema
  })
  .strict();

export const presenceSnapshotPayloadSchema = z
  .object({
    entries: z.array(presenceSnapshotEntrySchema),
    ts: z.number().int().nonnegative()
  })
  .strict();

export const presenceUpdateReasonSchema = z.enum([
  'create',
  'increment',
  'decay',
  'cap',
  'anomaly'
]);

export const presenceUpdatePayloadSchema = z
  .object({
    hexId: presenceHexIdSchema,
    delta: z.number().int(),
    newValue: z.number().int().positive(),
    reason: presenceUpdateReasonSchema,
    tierAfter: presenceTierIdSchema,
    ts: z.number().int().nonnegative()
  })
  .strict()
  .refine((payload) => payload.reason === 'create' || payload.delta !== 0, {
    message: 'Delta must be non-zero unless the reason is create'
  });

export const presenceBundledUpdatePayloadSchema = z
  .object({
    entries: z.array(presenceUpdatePayloadSchema).min(1),
    ts: z.number().int().nonnegative()
  })
  .strict();

export const presenceAnomalyTypeSchema = z.enum(['oscillation', 'rate', 'other']);

export const presenceAnomalyPayloadSchema = z
  .object({
    hexId: presenceHexIdSchema,
    type: presenceAnomalyTypeSchema,
    valueBefore: z.number().int().nonnegative(),
    valueAfter: z.number().int().nonnegative(),
    ts: z.number().int().nonnegative()
  })
  .strict();

export const presenceErrorCodeSchema = z.enum([
  'DENIED',
  'INVALID_PAYLOAD',
  'TOO_FREQUENT',
  'NOT_FOUND'
]);

export const presenceErrorPayloadSchema = z
  .object({
    code: presenceErrorCodeSchema,
    message: z.string().min(1)
  })
  .strict();

export const presenceRequestSnapshotPayloadSchema = z
  .object({
    since: z.number().int().nonnegative().optional()
  })
  .strict();

export const presenceDebugRequestPayloadSchema = z
  .object({
    playerId: z.string().min(1).optional(),
    hexId: presenceHexIdSchema.optional()
  })
  .strict();

export const presenceDebugDataPayloadSchema = z
  .object({
    entries: z.array(presenceSnapshotEntrySchema),
    playerId: z.string().min(1).optional(),
    hexId: presenceHexIdSchema.optional(),
    ts: z.number().int().nonnegative()
  })
  .strict();

export const presenceUpdateMessageSchema = makeTypedEnvelopeSchema(
  'presence:update',
  presenceUpdatePayloadSchema
);

export const presenceBundledUpdateMessageSchema = makeTypedEnvelopeSchema(
  'presence:update.bundled',
  presenceBundledUpdatePayloadSchema
);

export const presenceSnapshotMessageSchema = makeTypedEnvelopeSchema(
  'presence:snapshot',
  presenceSnapshotPayloadSchema
);

export const presenceAnomalyMessageSchema = makeTypedEnvelopeSchema(
  'presence:anomaly',
  presenceAnomalyPayloadSchema
);

export const presenceErrorMessageSchema = makeTypedEnvelopeSchema(
  'presence:error',
  presenceErrorPayloadSchema
);

export const presenceRequestSnapshotMessageSchema = makeTypedEnvelopeSchema(
  'presence:requestSnapshot',
  presenceRequestSnapshotPayloadSchema
);

export const presenceDebugRequestMessageSchema = makeTypedEnvelopeSchema(
  'presence:debugRequest',
  presenceDebugRequestPayloadSchema
);

export const presenceDebugDataMessageSchema = makeTypedEnvelopeSchema(
  'presence:debugData',
  presenceDebugDataPayloadSchema
);
