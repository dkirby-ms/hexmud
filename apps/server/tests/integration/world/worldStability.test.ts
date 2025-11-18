import { describe, expect, it } from 'vitest';

import {
  getWorldMetadata,
  listSpawnRegions,
  listWorldRegions,
  listWorldTiles
} from '../../../src/world/index.js';
import { loadTestWorld } from '../../helpers/world.js';

interface WorldSnapshot {
  metadata: {
    worldKey: string;
    name: string;
    version: number;
    boundaryPolicy: string;
  };
  regions: Array<{
    regionKey: string;
    name: string;
    type: string;
  }>;
  tiles: Array<{
    q: number;
    r: number;
    terrain: string;
    navigable: boolean;
    regionKey: string;
  }>;
  spawnRegions: Array<{
    name: string;
    regionKey: string;
    minDistanceFromEdge: number | null;
  }>;
}

const sortBy = <T>(items: T[], selector: (item: T) => string): T[] =>
  [...items].sort((a, b) => selector(a).localeCompare(selector(b)));

const captureSnapshot = async (): Promise<WorldSnapshot> => {
  await loadTestWorld();

  const metadata = getWorldMetadata();
  const regions = listWorldRegions();
  const tiles = listWorldTiles();
  const spawnRegions = listSpawnRegions();
  const regionKeyById = new Map(regions.map((region) => [region.id, region.regionKey] as const));

  return {
    metadata: {
      worldKey: metadata.worldKey,
      name: metadata.name,
      version: metadata.version,
      boundaryPolicy: metadata.boundaryPolicy
    },
    regions: sortBy(
      regions.map((region) => ({
        regionKey: region.regionKey,
        name: region.name,
        type: region.type
      })),
      (region) => region.regionKey
    ),
    tiles: tiles
      .map((tile) => ({
        q: tile.q,
        r: tile.r,
        terrain: tile.terrain,
        navigable: tile.navigable,
        regionKey: regionKeyById.get(tile.regionId) ?? 'unknown'
      }))
      .sort((a, b) => (a.q - b.q !== 0 ? a.q - b.q : a.r - b.r)),
    spawnRegions: sortBy(
      spawnRegions.map((spawnRegion) => ({
        name: spawnRegion.name,
        regionKey: regionKeyById.get(spawnRegion.regionId) ?? 'unknown',
        minDistanceFromEdge: spawnRegion.minDistanceFromEdge
      })),
      (spawn) => spawn.name
    )
  };
};

describe('default world stability', () => {
  it('produces identical layouts for repeated loads', async () => {
    const snapshotA = await captureSnapshot();
    const snapshotB = await captureSnapshot();

    expect(snapshotB).toEqual(snapshotA);
  });
});
