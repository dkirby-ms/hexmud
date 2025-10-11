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
