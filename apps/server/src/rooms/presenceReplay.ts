export type PresenceReplayEventType =
  | 'create'
  | 'increment'
  | 'decay'
  | 'cap'
  | 'anomaly'
  | 'tier-transition';

export interface PresenceReplayEvent {
  playerId: string;
  hexId: string;
  type: PresenceReplayEventType;
  valueBefore?: number;
  valueAfter?: number;
  tierFrom?: number;
  tierTo?: number;
  transitionDirection?: 'up' | 'down';
  timestamp: number;
}

export type PresenceReplaySubscriber = (event: PresenceReplayEvent) => void;

class PresenceReplayBus {
  private readonly subscribers = new Set<PresenceReplaySubscriber>();

  subscribe(handler: PresenceReplaySubscriber): () => void {
    this.subscribers.add(handler);
    return () => this.subscribers.delete(handler);
  }

  emit(event: PresenceReplayEvent): void {
    for (const handler of this.subscribers) {
      handler(event);
    }
  }
}

const bus = new PresenceReplayBus();

export const presenceReplay = {
  record(event: PresenceReplayEvent): void {
    bus.emit(event);
  },
  subscribe(handler: PresenceReplaySubscriber): () => void {
    return bus.subscribe(handler);
  }
};

export const createPresenceReplayRecorder = () => {
  const events: PresenceReplayEvent[] = [];
  const unsubscribe = presenceReplay.subscribe((event) => {
    events.push(event);
  });

  return {
    record(event: PresenceReplayEvent): void {
      presenceReplay.record(event);
    },
    flush(): PresenceReplayEvent[] {
      const snapshot = [...events];
      events.length = 0;
      return snapshot;
    },
    dispose(): void {
      unsubscribe();
      events.length = 0;
    }
  };
};
