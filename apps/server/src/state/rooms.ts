export interface RoomSummary {
  roomId: string;
  protocolVersion: number;
  sessionIds: Set<string>;
}

class RoomRegistry {
  private readonly rooms = new Map<string, RoomSummary>();

  get(roomId: string): RoomSummary | undefined {
    return this.rooms.get(roomId);
  }

  ensure(roomId: string, protocolVersion: number): RoomSummary {
    const existing = this.rooms.get(roomId);
    if (existing) {
      return existing;
    }

    const created: RoomSummary = {
      roomId,
      protocolVersion,
      sessionIds: new Set()
    };
    this.rooms.set(roomId, created);
    return created;
  }

  addSession(roomId: string, sessionId: string, protocolVersion: number): RoomSummary {
    const room = this.ensure(roomId, protocolVersion);
    room.sessionIds.add(sessionId);
    return room;
  }

  removeSession(roomId: string, sessionId: string): RoomSummary | undefined {
    const room = this.rooms.get(roomId);
    if (!room) {
      return undefined;
    }

    room.sessionIds.delete(sessionId);
    if (room.sessionIds.size === 0) {
      this.rooms.delete(roomId);
    }
    return room;
  }

  listRooms(): RoomSummary[] {
    return Array.from(this.rooms.values());
  }
}

export const rooms = new RoomRegistry();
