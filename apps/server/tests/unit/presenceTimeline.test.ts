import { beforeEach, describe, expect, it } from 'vitest';

import { presenceReplay } from '../../src/rooms/presenceReplay.js';
import {
  clearPresenceTimeline,
  getPresenceTimeline,
  type PresenceTimelineItem
} from '../../src/state/presenceTimeline.js';

const playerId = 'player-timeline';
const hexId = 'hex:1:2';

const recordEvent = (timestamp: number, overrides: Partial<PresenceTimelineItem> = {}) => {
  presenceReplay.record({
    playerId,
    hexId,
    type: overrides.type ?? 'increment',
    valueBefore: overrides.valueBefore,
    valueAfter: overrides.valueAfter,
    tierFrom: overrides.tierFrom,
    tierTo: overrides.tierTo,
    transitionDirection: overrides.transitionDirection,
    timestamp
  });
};

describe('presence timeline', () => {
  beforeEach(() => {
    clearPresenceTimeline();
  });

  it('returns events within the requested window ordered chronologically', () => {
    recordEvent(0, { type: 'create', valueAfter: 1 });
    recordEvent(30_000, { valueBefore: 1, valueAfter: 5 });
    recordEvent(90_000, { type: 'decay', valueBefore: 5, valueAfter: 4 });

    const timeline = getPresenceTimeline({
      playerId,
      hexId,
      windowMs: 60_000,
      now: 120_000
    });

    expect(timeline).toHaveLength(1);
    expect(timeline[0]).toMatchObject({
      type: 'decay',
      ts: 90_000,
      valueBefore: 5,
      valueAfter: 4,
      delta: -1
    });
  });

  it('applies limit to recent events', () => {
    for (let index = 0; index < 10; index += 1) {
      recordEvent(index * 10_000, {
        valueBefore: index,
        valueAfter: index + 1
      });
    }

    const timeline = getPresenceTimeline({
      playerId,
      hexId,
      limit: 3,
      now: 200_000
    });

    expect(timeline).toHaveLength(3);
  expect(timeline.map((entry) => entry.valueAfter)).toEqual([8, 9, 10]);
  });
});
