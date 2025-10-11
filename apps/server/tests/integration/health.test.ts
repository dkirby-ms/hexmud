import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/server.js';

describe('GET /healthz', () => {
  it('returns ok status', async () => {
    const app = createApp();
    const response = await request(app).get('/healthz');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok' });
  });
});
