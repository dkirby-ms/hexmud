// Structured log event type definitions for authentication lifecycle.

interface AuthLogEventBase {
  authCorrId?: string;
}

export type AuthLogEvent =
  | (AuthLogEventBase & {
      type: 'auth.signin.success';
      sessionId: string;
      playerId: string;
      source?: 'redirect' | 'popup' | 'silent';
    })
  | (AuthLogEventBase & {
      type: 'auth.signin.failure';
      sessionId: string;
      reason: string;
      stage?: 'interactive' | 'silent';
    })
  | (AuthLogEventBase & {
      type: 'auth.token.validation.failure';
      sessionId: string;
      reason: string;
    })
  | (AuthLogEventBase & {
      type: 'auth.signout';
      sessionId: string;
      playerId: string;
      method?: 'interactive' | 'silent' | 'timeout';
    })
  | (AuthLogEventBase & {
      type: 'auth.renewal.success';
      sessionId: string;
      playerId: string;
      latencyMs?: number;
    })
  | (AuthLogEventBase & {
      type: 'auth.renewal.failure';
      sessionId: string;
      reason: string;
      retryInSeconds?: number;
    });

export type AuthLogEventType = AuthLogEvent['type'];
