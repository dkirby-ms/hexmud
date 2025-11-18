import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../../src/server.js';
import { loadTestWorld } from '../../helpers/world.js';

describe('default world HTTP endpoints', () => {
  beforeAll(async () => {
    await loadTestWorld();
  });

  it('returns metadata for GET /worlds/default', async () => {
    const app = createApp();
    const response = await request(app).get('/worlds/default');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      worldKey: 'default',
      name: expect.any(String),
      version: expect.any(String),
      boundaryPolicy: 'hard-edge'
    });
  });

  it('lists regions for GET /worlds/default/regions', async () => {
    const app = createApp();
    const response = await request(app).get('/worlds/default/regions');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0]).toMatchObject({
      regionKey: expect.any(String),
      name: expect.any(String),
      type: expect.any(String)
    });
  });

  it('lists tiles and supports region filtering', async () => {
    const app = createApp();
    const allTilesResponse = await request(app).get('/worlds/default/tiles');

    expect(allTilesResponse.status).toBe(200);
    expect(Array.isArray(allTilesResponse.body)).toBe(true);
    expect(allTilesResponse.body.length).toBeGreaterThan(0);

    const filteredResponse = await request(app)
      .get('/worlds/default/tiles')
      .query({ regionKey: 'continent_a' });

    expect(filteredResponse.status).toBe(200);
    expect(filteredResponse.body.length).toBeGreaterThan(0);
    expect(filteredResponse.body.every((tile: { regionKey: string }) => tile.regionKey === 'continent_a')).toBe(true);
  });

  it('returns 404 when filtering tiles by an unknown region', async () => {
    const app = createApp();
    const response = await request(app)
      .get('/worlds/default/tiles')
      .query({ regionKey: 'missing_region' });

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ error: 'REGION_NOT_FOUND' });
  });

  it('lists spawn regions for GET /worlds/default/spawn-regions', async () => {
    const app = createApp();
    const response = await request(app).get('/worlds/default/spawn-regions');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0]).toMatchObject({
      name: expect.any(String),
      regionKey: expect.any(String)
    });
  });
});
