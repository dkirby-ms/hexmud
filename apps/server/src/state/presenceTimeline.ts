import { presenceReplay, type PresenceReplayEvent } from '../rooms/presenceReplay.js';

export type PresenceTimelineEventType = PresenceReplayEvent['type'];

export interface PresenceTimelineItem {
  ts: number;
  type: PresenceTimelineEventType;
  valueBefore?: number;
  valueAfter?: number;
  delta?: number;
  tierFrom?: number;
  tierTo?: number;
  transitionDirection?: 'up' | 'down';
}

export interface PresenceTimelineQuery {
  playerId: string;
  hexId: string;
  windowMs?: number;
  now?: number;
  limit?: number;
}

interface TimelineEntry {
  timestamp: number;
  event: PresenceTimelineItem;
}

const MAX_EVENTS_PER_KEY = 256;
const DEFAULT_WINDOW_MS = 86_400_000;
const DEFAULT_LIMIT = 100;

const timelineStore = new Map<string, TimelineEntry[]>();

const timelineKey = (playerId: string, hexId: string): string => `${playerId}::${hexId}`;

const computeDelta = (event: PresenceReplayEvent): number | undefined => {
  if (typeof event.valueAfter === 'number' && typeof event.valueBefore === 'number') {
    return event.valueAfter - event.valueBefore;
  }
  if (event.type === 'create' && typeof event.valueAfter === 'number') {
    return event.valueAfter;
  }
  return undefined;
};

const toTimelineItem = (event: PresenceReplayEvent): PresenceTimelineItem => ({
  ts: event.timestamp,
  type: event.type,
  valueBefore: event.valueBefore,
  valueAfter: event.valueAfter,
  delta: computeDelta(event),
  tierFrom: event.tierFrom,
  tierTo: event.tierTo,
  transitionDirection: event.transitionDirection
});

const pruneStaleEntries = (entries: TimelineEntry[]): void => {
  if (entries.length <= MAX_EVENTS_PER_KEY) {
    return;
  }
  entries.splice(0, entries.length - MAX_EVENTS_PER_KEY);
};

const recordTimelineEvent = (event: PresenceReplayEvent): void => {
  const key = timelineKey(event.playerId, event.hexId);
  const current = timelineStore.get(key);
  const nextEntry: TimelineEntry = {
    timestamp: event.timestamp,
    event: toTimelineItem(event)
  };

  if (!current) {
    timelineStore.set(key, [nextEntry]);
    return;
  }

  current.push(nextEntry);
  pruneStaleEntries(current);
};

presenceReplay.subscribe((event) => {
  recordTimelineEvent(event);
});

export const getPresenceTimeline = ({
  playerId,
  hexId,
  windowMs = DEFAULT_WINDOW_MS,
  now = Date.now(),
  limit = DEFAULT_LIMIT
}: PresenceTimelineQuery): PresenceTimelineItem[] => {
  const key = timelineKey(playerId, hexId);
  const entries = timelineStore.get(key);
  if (!entries || entries.length === 0) {
    return [];
  }

  const windowStart = now - Math.max(0, windowMs);
  const filtered = entries.filter((entry) => entry.timestamp >= windowStart);
  if (filtered.length === 0) {
    return [];
  }

  const startIndex = Math.max(0, filtered.length - Math.max(1, limit));
  return filtered.slice(startIndex).map((entry) => ({ ...entry.event }));
};

export const clearPresenceTimeline = (): void => {
  timelineStore.clear();
};
