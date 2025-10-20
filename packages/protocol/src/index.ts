export { PROTOCOL_VERSION } from './version.js';

export {
	envelopeSchema,
	enforceProtocolVersion,
	createEnvelope,
	makeTypedEnvelopeSchema
} from './messages/envelope.js';
export type { Envelope } from './messages/envelope.js';

export {
	heartbeatPayloadSchema,
	sessionWelcomePayloadSchema,
	errorPayloadSchema,
	errorCodeSchema,
	heartbeatMessageSchema,
	sessionWelcomeMessageSchema,
	errorMessageSchema
} from './messages/core.js';
export type {
	HeartbeatPayload,
	SessionWelcomePayload,
	ErrorPayload,
	ErrorCode,
	HeartbeatMessage,
	SessionWelcomeMessage,
	ErrorMessage
} from './messages/core.js';

export type {
	PresenceUpdateReason,
	PresenceAnomalyType,
	PresenceSummaryEntry,
	PresenceSnapshotEntry,
	PresenceSnapshotPayload,
	PresenceUpdatePayload,
	PresenceBundledUpdatePayload,
	PresenceAnomalyPayload,
	PresenceErrorCode,
	PresenceErrorPayload,
	PresenceRequestSnapshotPayload,
	PresenceDebugRequestPayload,
	PresenceDebugDataPayload
} from './messages/presence.js';

export {
	presenceHexIdRegex,
	presenceHexIdSchema,
	presenceTierIdSchema,
	presenceSnapshotEntrySchema,
	presenceSnapshotPayloadSchema,
	presenceUpdateReasonSchema,
	presenceUpdatePayloadSchema,
	presenceBundledUpdatePayloadSchema,
	presenceAnomalyTypeSchema,
	presenceAnomalyPayloadSchema,
	presenceErrorCodeSchema,
	presenceErrorPayloadSchema,
	presenceRequestSnapshotPayloadSchema,
	presenceDebugRequestPayloadSchema,
	presenceDebugDataPayloadSchema,
	presenceUpdateMessageSchema,
	presenceBundledUpdateMessageSchema,
	presenceSnapshotMessageSchema,
	presenceAnomalyMessageSchema,
	presenceErrorMessageSchema,
	presenceRequestSnapshotMessageSchema,
	presenceDebugRequestMessageSchema,
	presenceDebugDataMessageSchema
} from './messages/presenceSchemas.js';
