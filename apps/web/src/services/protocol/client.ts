import { Client } from 'colyseus.js';
import type { Room } from 'colyseus.js';

const resolveServerUrl = (): string => {
  const env = import.meta.env as Record<string, string | undefined>;
  const value = env.VITE_SERVER_URL;
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname;
  const port = window.location.port || '2567';
  return `${protocol}//${host}:${port}`;
};

export const createProtocolClient = (): Client => new Client(resolveServerUrl());

export interface JoinPlaceholderRoomOptions {
  accessToken?: string;
  protocolVersion: number;
}

export const joinPlaceholderRoom = async (
  client: Client,
  options: JoinPlaceholderRoomOptions
): Promise<Room<unknown>> => client.joinOrCreate<unknown>('placeholder', options);
