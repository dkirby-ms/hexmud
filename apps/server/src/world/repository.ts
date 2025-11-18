import type { Pool, QueryResultRow } from 'pg';

import type {
  BoundaryPolicy,
  WorldDefinition,
  WorldHexTile,
  WorldRegion,
  WorldSpawnRegion
} from './types.js';

export interface WorldDataSnapshot {
  definition: WorldDefinition;
  regions: WorldRegion[];
  tiles: WorldHexTile[];
  spawnRegions: WorldSpawnRegion[];
}

export interface WorldDataSource {
  loadWorld(worldKey: string): Promise<WorldDataSnapshot | null>;
}

const mapTimestamp = (value: Date | string): Date =>
  value instanceof Date ? value : new Date(value);

interface WorldDefinitionRow extends QueryResultRow {
  id: number;
  world_key: string;
  name: string;
  description: string | null;
  version: number;
  boundary_policy: BoundaryPolicy;
  created_at: Date | string;
  updated_at: Date | string;
}

const mapWorldDefinition = (row: WorldDefinitionRow): WorldDefinition => ({
  id: Number(row.id),
  worldKey: row.world_key,
  name: row.name,
  description: row.description,
  version: Number(row.version),
  boundaryPolicy: row.boundary_policy,
  createdAt: mapTimestamp(row.created_at),
  updatedAt: mapTimestamp(row.updated_at)
});

interface WorldRegionRow extends QueryResultRow {
  id: number;
  world_id: number;
  region_key: string;
  name: string;
  type: WorldRegion['type'];
  description: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

const mapWorldRegion = (row: WorldRegionRow): WorldRegion => ({
  id: Number(row.id),
  worldId: Number(row.world_id),
  regionKey: row.region_key,
  name: row.name,
  type: row.type,
  description: row.description,
  createdAt: mapTimestamp(row.created_at),
  updatedAt: mapTimestamp(row.updated_at)
});

interface WorldHexTileRow extends QueryResultRow {
  id: number;
  world_id: number;
  region_id: number;
  q: number;
  r: number;
  terrain: WorldHexTile['terrain'];
  navigable: boolean;
  label: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

const mapWorldHexTile = (row: WorldHexTileRow): WorldHexTile => ({
  id: Number(row.id),
  worldId: Number(row.world_id),
  regionId: Number(row.region_id),
  q: Number(row.q),
  r: Number(row.r),
  terrain: row.terrain,
  navigable: row.navigable,
  label: row.label,
  createdAt: mapTimestamp(row.created_at),
  updatedAt: mapTimestamp(row.updated_at)
});

interface WorldSpawnRegionRow extends QueryResultRow {
  id: number;
  world_id: number;
  region_id: number;
  name: string;
  description: string | null;
  min_distance_from_edge: number | null;
  created_at: Date | string;
  updated_at: Date | string;
}

const mapWorldSpawnRegion = (row: WorldSpawnRegionRow): WorldSpawnRegion => ({
  id: Number(row.id),
  worldId: Number(row.world_id),
  regionId: Number(row.region_id),
  name: row.name,
  description: row.description,
  minDistanceFromEdge:
    row.min_distance_from_edge === null ? null : Number(row.min_distance_from_edge),
  createdAt: mapTimestamp(row.created_at),
  updatedAt: mapTimestamp(row.updated_at)
});

export interface WorldRepositoryDependencies {
  pool: Pool;
}

export class WorldRepository implements WorldDataSource {
  private readonly pool: Pool;

  constructor({ pool }: WorldRepositoryDependencies) {
    this.pool = pool;
  }

  async getWorldDefinition(worldKey: string): Promise<WorldDefinition | null> {
    const result = await this.pool.query<WorldDefinitionRow>(
      `SELECT id, world_key, name, description, version, boundary_policy, created_at, updated_at
       FROM world_definition
       WHERE world_key = $1
       LIMIT 1`,
      [worldKey]
    );

    if (result.rowCount === 0) {
      return null;
    }

    return mapWorldDefinition(result.rows[0]!);
  }

  async listRegions(worldId: number): Promise<WorldRegion[]> {
    const result = await this.pool.query<WorldRegionRow>(
      `SELECT id, world_id, region_key, name, type, description, created_at, updated_at
       FROM world_region
       WHERE world_id = $1
       ORDER BY region_key ASC`,
      [worldId]
    );
    return result.rows.map(mapWorldRegion);
  }

  async listHexTiles(worldId: number): Promise<WorldHexTile[]> {
    const result = await this.pool.query<WorldHexTileRow>(
      `SELECT id, world_id, region_id, q, r, terrain, navigable, label, created_at, updated_at
       FROM world_hex_tile
       WHERE world_id = $1`,
      [worldId]
    );

    return result.rows.map(mapWorldHexTile);
  }

  async listSpawnRegions(worldId: number): Promise<WorldSpawnRegion[]> {
    const result = await this.pool.query<WorldSpawnRegionRow>(
      `SELECT id, world_id, region_id, name, description, min_distance_from_edge, created_at, updated_at
       FROM world_spawn_region
       WHERE world_id = $1
       ORDER BY name ASC`,
      [worldId]
    );

    return result.rows.map(mapWorldSpawnRegion);
  }

  async loadWorld(worldKey: string): Promise<WorldDataSnapshot | null> {
    const definition = await this.getWorldDefinition(worldKey);
    if (!definition) {
      return null;
    }

    const [regions, tiles, spawnRegions] = await Promise.all([
      this.listRegions(definition.id),
      this.listHexTiles(definition.id),
      this.listSpawnRegions(definition.id)
    ]);

    return {
      definition,
      regions,
      tiles,
      spawnRegions
    } satisfies WorldDataSnapshot;
  }
}
