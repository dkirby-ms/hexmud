import { createEnvelope, PROTOCOL_VERSION } from '@hexmud/protocol';
import type { Client, Room } from 'colyseus.js';


import { createProtocolClient, joinPlaceholderRoom } from '../services/protocol/client.js';

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
    const room = await joinPlaceholderRoom(client, {
      protocolVersion: resolveProtocolVersion(),
      accessToken: accessToken ?? undefined
    });

    const disconnect = async () => {
      try {
        await room.leave(true);
      } catch (error) {
        // If the room is already closed ignore the error
        if (import.meta.env.DEV) {
          console.warn('Failed to leave placeholder room cleanly', error);
        }
      }
      closeClient(client);
    };

    return { client, room, disconnect };
  } catch (error) {
    closeClient(client);
    throw error;
  }
};

export const sendHeartbeat = (room: Room<unknown>): void => {
  room.send('envelope', createEnvelope('heartbeat', {}));
};
