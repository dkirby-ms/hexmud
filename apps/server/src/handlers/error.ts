import { createEnvelope, type ErrorCode } from '@hexmud/protocol';
import type { Client } from 'colyseus';


export const sendErrorEnvelope = (client: Client, code: ErrorCode, message: string): void => {
  client.send(
    'envelope',
    createEnvelope('error', {
      code,
      message
    })
  );
};
