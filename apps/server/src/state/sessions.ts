import { recordActiveSessionCount, recordSessionCreated } from '../metrics/adapter.js';

export type ConnectionState = 'joining' | 'active' | 'closing';

export interface PlayerIdentity {
  playerId: string;
  displayName?: string;
  roles: string[];
  authClaims: Record<string, unknown>;
  sessionPolicy: {
    allowConcurrent: boolean;
  };
}

export interface PlayerSession {
  sessionId: string;
  playerId: string;
  connectedAt: Date;
  lastHeartbeatAt: Date;
  connectionState: ConnectionState;
  protocolVersion: number;
  roomId?: string;
}

interface SessionStoreSnapshot {
  identities: Map<string, PlayerIdentity>;
  sessions: Map<string, PlayerSession>;
  sessionsByPlayer: Map<string, Set<string>>;
  activeSessions: Set<string>;
}

const createSnapshot = (): SessionStoreSnapshot => ({
  identities: new Map(),
  sessions: new Map(),
  sessionsByPlayer: new Map(),
  activeSessions: new Set()
});

class SessionStore {
  private readonly snapshot = createSnapshot();

  private syncActiveState(sessionId: string, nextState: ConnectionState): boolean {
    const isActive = this.snapshot.activeSessions.has(sessionId);
    if (nextState === 'active') {
      if (!isActive) {
        this.snapshot.activeSessions.add(sessionId);
        return true;
      }
      return false;
    }

    if (isActive) {
      this.snapshot.activeSessions.delete(sessionId);
      return true;
    }
    return false;
  }

  upsertIdentity(identity: PlayerIdentity): PlayerIdentity {
    this.snapshot.identities.set(identity.playerId, identity);
    if (!this.snapshot.sessionsByPlayer.has(identity.playerId)) {
      this.snapshot.sessionsByPlayer.set(identity.playerId, new Set());
    }
    return identity;
  }

  getIdentity(playerId: string): PlayerIdentity | undefined {
    return this.snapshot.identities.get(playerId);
  }

  createSession(session: PlayerSession): PlayerSession {
    this.snapshot.sessions.set(session.sessionId, session);
    const sessionsForPlayer =
      this.snapshot.sessionsByPlayer.get(session.playerId) ?? new Set<string>();
    sessionsForPlayer.add(session.sessionId);
    this.snapshot.sessionsByPlayer.set(session.playerId, sessionsForPlayer);

    const activeChanged = this.syncActiveState(session.sessionId, session.connectionState);

    recordSessionCreated({
      playerId: session.playerId,
      roomId: session.roomId ?? 'unassigned'
    });

    if (activeChanged) {
      recordActiveSessionCount(this.snapshot.activeSessions.size);
    }
    return session;
  }

  getSession(sessionId: string): PlayerSession | undefined {
    return this.snapshot.sessions.get(sessionId);
  }

  updateSession(sessionId: string, update: Partial<PlayerSession>): PlayerSession | undefined {
    const existing = this.snapshot.sessions.get(sessionId);
    if (!existing) {
      return undefined;
    }

    const next = { ...existing, ...update } satisfies PlayerSession;
    this.snapshot.sessions.set(sessionId, next);

    const stateChanged = this.syncActiveState(sessionId, next.connectionState);
    if (stateChanged) {
      recordActiveSessionCount(this.snapshot.activeSessions.size);
    }
    return next;
  }

  removeSession(sessionId: string): PlayerSession | undefined {
    const session = this.snapshot.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }

    this.snapshot.sessions.delete(sessionId);
    const sessionsForPlayer = this.snapshot.sessionsByPlayer.get(session.playerId);
    sessionsForPlayer?.delete(sessionId);
    if (sessionsForPlayer && sessionsForPlayer.size === 0) {
      this.snapshot.sessionsByPlayer.delete(session.playerId);
    }

    const stateChanged = this.syncActiveState(sessionId, 'closing');
    if (stateChanged) {
      recordActiveSessionCount(this.snapshot.activeSessions.size);
    }
    return session;
  }

  listSessionsByPlayer(playerId: string): PlayerSession[] {
    const sessionIds = this.snapshot.sessionsByPlayer.get(playerId);
    if (!sessionIds) {
      return [];
    }
    return Array.from(sessionIds)
      .map((sessionId) => this.snapshot.sessions.get(sessionId))
      .filter((session): session is PlayerSession => Boolean(session));
  }

  listActiveSessions(): PlayerSession[] {
    if (this.snapshot.activeSessions.size === 0) {
      return [];
    }

    return Array.from(this.snapshot.activeSessions)
      .map((sessionId) => this.snapshot.sessions.get(sessionId))
      .filter((session): session is PlayerSession => Boolean(session));
  }
}

export const sessions = new SessionStore();
