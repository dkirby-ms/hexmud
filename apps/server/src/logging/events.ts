// Structured log event type definitions for authentication lifecycle and related events.

export type AuthLogEvent =
  | {
      type: 'auth.token.validated';
      playerId: string;
      sessionId: string;
      claims: Record<string, unknown>;
    }
  | {
      type: 'auth.token.invalid';
      sessionId: string;
      reason: string;
    }
  | {
      type: 'auth.token.missing';
      sessionId: string;
    }
  | {
      type: 'auth.identity.persisted';
      playerId: string;
      claims: Record<string, unknown>;
    };

export type AuthLogEventType = AuthLogEvent['type'];
