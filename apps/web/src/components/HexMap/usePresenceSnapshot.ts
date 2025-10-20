import {
  createEnvelope,
  presenceErrorMessageSchema,
  presenceSnapshotMessageSchema,
  type PresenceSnapshotEntry,
  type PresenceUpdatePayload
} from '@hexmud/protocol';
import type { Room } from 'colyseus.js';
import { useCallback, useEffect, useReducer } from 'react';

export interface PresenceCell {
  hexId: string;
  value: number;
  tierId: number;
  updatedAt: number;
  lastReason?: PresenceUpdatePayload['reason'];
}

interface PresenceSnapshotState {
  cells: Map<string, PresenceCell>;
  loading: boolean;
  error?: string;
  lastSnapshotTs?: number;
  lastUpdateTs?: number;
}

type PresenceSnapshotAction =
  | { type: 'reset' }
  | { type: 'loading' }
  | { type: 'snapshot'; entries: PresenceSnapshotEntry[]; ts: number }
  | { type: 'update'; update: PresenceUpdatePayload }
  | { type: 'error'; message: string };

const initialState: PresenceSnapshotState = {
  cells: new Map(),
  loading: false,
  error: undefined,
  lastSnapshotTs: undefined,
  lastUpdateTs: undefined
};

const updateCellMap = (
  entries: PresenceSnapshotEntry[],
  snapshotTs: number
): Map<string, PresenceCell> => {
  const map = new Map<string, PresenceCell>();

  for (const entry of entries) {
    map.set(entry.hexId, {
      hexId: entry.hexId,
      value: entry.value,
      tierId: entry.tierId,
      updatedAt: snapshotTs,
      lastReason: undefined
    });
  }

  return map;
};

const snapshotReducer = (
  state: PresenceSnapshotState,
  action: PresenceSnapshotAction
): PresenceSnapshotState => {
  switch (action.type) {
    case 'reset':
      return {
        cells: new Map(),
        loading: false,
        error: undefined,
        lastSnapshotTs: undefined,
        lastUpdateTs: undefined
      };
    case 'loading':
      return {
        ...state,
        loading: true,
        error: undefined
      };
    case 'snapshot':
      return {
        cells: updateCellMap(action.entries, action.ts),
        loading: false,
        error: undefined,
        lastSnapshotTs: action.ts,
        lastUpdateTs: state.lastUpdateTs
      };
    case 'update': {
      const nextCells = new Map(state.cells);
      nextCells.set(action.update.hexId, {
        hexId: action.update.hexId,
        value: action.update.newValue,
        tierId: action.update.tierAfter,
        updatedAt: action.update.ts,
        lastReason: action.update.reason
      });
      return {
        cells: nextCells,
        loading: false,
        error: state.error,
        lastSnapshotTs: state.lastSnapshotTs,
        lastUpdateTs: action.update.ts
      };
    }
    case 'error':
      return {
        ...state,
        loading: false,
        error: action.message
      };
    default:
      return state;
  }
};

const detachListener = (
  room: Room<unknown>,
  handler: (message: unknown) => void
): void => {
  const candidate = room as unknown as {
    removeListener?: (type: string, cb: (message: unknown) => void) => void;
    off?: (type: string, cb: (message: unknown) => void) => void;
  };
  if (typeof candidate.removeListener === 'function') {
    candidate.removeListener('envelope', handler);
  } else if (typeof candidate.off === 'function') {
    candidate.off('envelope', handler);
  }
};

export interface PresenceSnapshotHookResult extends PresenceSnapshotState {
  requestSnapshot: () => void;
  applyUpdate: (update: PresenceUpdatePayload) => void;
}

export const usePresenceSnapshot = (
  room: Room<unknown> | undefined
): PresenceSnapshotHookResult => {
  const [state, dispatch] = useReducer(snapshotReducer, initialState);

  const applyUpdate = useCallback((update: PresenceUpdatePayload) => {
    dispatch({ type: 'update', update });
  }, []);

  const requestSnapshot = useCallback(() => {
    if (!room) {
      dispatch({ type: 'error', message: 'Presence snapshot unavailable: not connected.' });
      return;
    }

    dispatch({ type: 'loading' });
    try {
      room.send('envelope', createEnvelope('presence:requestSnapshot', {}));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to request presence snapshot';
      dispatch({ type: 'error', message });
    }
  }, [room]);

  useEffect(() => {
    if (!room) {
      dispatch({ type: 'reset' });
      return;
    }

    const handleEnvelope = (raw: unknown) => {
      const snapshotResult = presenceSnapshotMessageSchema.safeParse(raw);
      if (snapshotResult.success) {
        dispatch({
          type: 'snapshot',
          entries: snapshotResult.data.payload.entries,
          ts: snapshotResult.data.payload.ts
        });
        return;
      }

      const errorResult = presenceErrorMessageSchema.safeParse(raw);
      if (errorResult.success) {
        dispatch({ type: 'error', message: errorResult.data.payload.message });
      }
    };

    room.onMessage('envelope', handleEnvelope);
    requestSnapshot();

    return () => {
      detachListener(room, handleEnvelope);
    };
  }, [room, requestSnapshot]);

  return {
    ...state,
    requestSnapshot,
    applyUpdate
  };
};
