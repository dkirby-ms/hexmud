import { Client } from 'colyseus.js';
import type { Room } from 'colyseus.js';

const resolveServerUrl = (): string => {
  const env = import.meta.env as Record<string, string | undefined>;
  const value = env.VITE_SERVER_URL;
  if (typeof value === 'string' && value.length > 0) {
    try {
      const parsed = new URL(value);
      if (parsed.protocol === 'http:') {
        parsed.protocol = 'ws:';
      } else if (parsed.protocol === 'https:') {
        parsed.protocol = 'wss:';
      }
      const normalized = parsed.toString();
      if (import.meta.env.DEV) {
        console.info('[protocol] Using configured server URL', normalized);
      }
      return normalized;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('Invalid VITE_SERVER_URL value; falling back to window location', error);
      }
    }
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname;
  const port = window.location.port || '2567';
  const fallback = `${protocol}//${host}:${port}`;
  if (import.meta.env.DEV) {
    console.info('[protocol] Using fallback server URL', fallback);
  }
  return fallback;
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
