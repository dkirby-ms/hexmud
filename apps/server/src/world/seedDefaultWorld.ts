import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import type { Pool } from 'pg';

import type { TerrainType } from './types.js';

const DEFAULT_SEED_PATH = fileURLToPath(new URL('./defaultWorldSeed.json', import.meta.url));

interface SeedWorldDefinition {
  worldKey: string;
  name: string;
  description: string;
  version: number;
  boundaryPolicy: string;
}

interface SeedTile {
  q: number;
  r: number;
  terrain: TerrainType;
  navigable: boolean;
  label?: string;
}

interface SeedRegion {
  regionKey: string;
  name: string;
  type: 'continent' | 'ocean' | 'island_chain' | 'other';
  description: string;
  tiles: SeedTile[];
}

interface SeedSpawnRegion {
  name: string;
  regionKey: string;
  description: string;
  minDistanceFromEdge?: number;
}

interface DefaultWorldSeedFile {
  world: SeedWorldDefinition;
  regions: SeedRegion[];
  spawnRegions: SeedSpawnRegion[];
}

export interface SeedDefaultWorldOptions {
  pool: Pool;
  seedPath?: string;
}

export interface SeedDefaultWorldResult {
  worldKey: string;
  inserted: boolean;
  regionCount: number;
  tileCount: number;
  spawnRegionCount: number;
}

const loadSeedFile = async (seedPath: string): Promise<DefaultWorldSeedFile> => {
  const contents = await readFile(seedPath, 'utf8');
  return JSON.parse(contents) as DefaultWorldSeedFile;
};

export const seedDefaultWorld = async ({
  pool,
  seedPath = DEFAULT_SEED_PATH
}: SeedDefaultWorldOptions): Promise<SeedDefaultWorldResult> => {
  const seed = await loadSeedFile(seedPath);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query<{ id: number }>(
      `SELECT id FROM world_definition WHERE world_key = $1 LIMIT 1`,
      [seed.world.worldKey]
    );

    const existingCount = existing.rowCount ?? 0;
    if (existingCount > 0) {
      await client.query('ROLLBACK');
      return {
        worldKey: seed.world.worldKey,
        inserted: false,
        regionCount: 0,
        tileCount: 0,
        spawnRegionCount: 0
      };
    }

    const worldResult = await client.query<{ id: number }>(
      `INSERT INTO world_definition (world_key, name, description, version, boundary_policy)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        seed.world.worldKey,
        seed.world.name,
        seed.world.description,
        seed.world.version,
        seed.world.boundaryPolicy
      ]
    );

    const worldId = worldResult.rows[0]?.id;
    if (!worldId) {
      throw new Error('Failed to insert world definition');
    }

    const regionIdMap = new Map<string, number>();
    let tileCount = 0;

    for (const region of seed.regions) {
      const regionResult = await client.query<{ id: number }>(
        `INSERT INTO world_region (world_id, region_key, name, type, description)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [worldId, region.regionKey, region.name, region.type, region.description]
      );

      const regionId = regionResult.rows[0]?.id;
      if (!regionId) {
        throw new Error(`Failed to insert region ${region.regionKey}`);
      }

      regionIdMap.set(region.regionKey, regionId);

      for (const tile of region.tiles) {
        await client.query(
          `INSERT INTO world_hex_tile (world_id, region_id, q, r, terrain, navigable, label)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            worldId,
            regionId,
            tile.q,
            tile.r,
            tile.terrain,
            tile.navigable,
            tile.label ?? null
          ]
        );
        tileCount += 1;
      }
    }

    let spawnRegionCount = 0;
    for (const spawnRegion of seed.spawnRegions) {
      const regionId = regionIdMap.get(spawnRegion.regionKey);
      if (!regionId) {
        throw new Error(
          `Cannot create spawn region "${spawnRegion.name}" for unknown region ${spawnRegion.regionKey}`
        );
      }

      await client.query(
        `INSERT INTO world_spawn_region (world_id, region_id, name, description, min_distance_from_edge)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          worldId,
          regionId,
          spawnRegion.name,
          spawnRegion.description,
          spawnRegion.minDistanceFromEdge ?? null
        ]
      );
      spawnRegionCount += 1;
    }

    await client.query('COMMIT');

    return {
      worldKey: seed.world.worldKey,
      inserted: true,
      regionCount: seed.regions.length,
      tileCount,
      spawnRegionCount
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
