import { createEnvelope, PROTOCOL_VERSION } from '@hexmud/protocol';
import type { Client, Room } from 'colyseus.js';


import {
  createProtocolClient,
  joinPlaceholderRoom,
  joinWorldRoom
} from '../services/protocol/client.js';

export interface PlaceholderConnection {
  client: Client;
  room: Room<unknown>;
  disconnect: () => Promise<void>;
}

const parseNumeric = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

const resolveProtocolVersion = (): number => {
  const candidate =
    parseNumeric((import.meta).env?.VITE_PROTOCOL_VERSION) ?? null;

  return candidate ?? PROTOCOL_VERSION;
};

const closeClient = (client: Client) => {
  const connection = (client as unknown as { connection?: WebSocket }).connection;
  if (connection && typeof connection.close === 'function') {
    connection.close();
  }
  if (typeof (client as unknown as { close?: () => void }).close === 'function') {
    (client as unknown as { close: () => void }).close();
  }
};

export const connectToPlaceholderWorld = async (
  accessToken?: string | null
): Promise<PlaceholderConnection> => {
  const client = createProtocolClient();

  try {
    const options = {
      protocolVersion: resolveProtocolVersion(),
      accessToken: accessToken ?? undefined
    } as const;

    const roomsToAttempt = ['world', 'placeholder'] as const;
    let joinedRoom: Room<unknown> | null = null;
    let lastError: unknown;

    for (const roomName of roomsToAttempt) {
      try {
        joinedRoom =
          roomName === 'world'
            ? await joinWorldRoom(client, options)
            : await joinPlaceholderRoom(client, options);

        if (import.meta.env.DEV) {
          console.info('[protocol] Joined room', roomName);
        }
        break;
      } catch (error) {
        lastError = error;
        if (import.meta.env.DEV) {
          console.warn('[protocol] Failed to join room', roomName, error);
        }
      }
    }

    if (!joinedRoom) {
      throw lastError ?? new Error('Failed to join any room');
    }

    const disconnect = async () => {
      try {
        await joinedRoom!.leave(true);
      } catch (error) {
        // If the room is already closed ignore the error
        if (import.meta.env.DEV) {
          console.warn('Failed to leave placeholder room cleanly', error);
        }
      }
      closeClient(client);
    };

    return { client, room: joinedRoom, disconnect };
  } catch (error) {
    closeClient(client);
    throw error;
  }
};

export const sendHeartbeat = (room: Room<unknown>): void => {
  room.send('envelope', createEnvelope('heartbeat', {}));
};
