declare module 'colyseus.js' {
  export interface Room<T = unknown> {
    leave(consent?: boolean): Promise<void>;
    send(type: string, message: unknown): void;
  }

  export class Client {
    constructor(endpoint: string);
    joinOrCreate<T = unknown>(roomName: string, options?: unknown): Promise<Room<T>>;
    close(): void;
    connection?: WebSocket;
  }
}
