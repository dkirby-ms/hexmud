import { describe, expect, it, beforeEach, vi } from 'vitest';

import {
  getHexTile,
  getRegionByKey,
  getRegionForTile,
  getTilesForRegion,
  getWorldMetadata,
  isWorldLoaded,
  listSpawnRegions,
  listWorldRegions,
  listWorldTiles,
  loadWorldModule,
  resetWorldModuleForTests,
  selectSpawnHex
} from '../../src/world/index.js';
import type { WorldDefinition, WorldHexTile, WorldRegion, WorldSpawnRegion } from '../../src/world/types.js';
import type { WorldRepository } from '../../src/world/repository.js';

const buildWorldDefinition = (): WorldDefinition => ({
  id: 42,
  worldKey: 'default',
  name: 'Default World',
  description: null,
  version: 1,
  boundaryPolicy: 'hard-edge',
  createdAt: new Date(),
  updatedAt: new Date()
});

const buildRegion = (overrides: Partial<WorldRegion>): WorldRegion => ({
  id: overrides.id ?? 1,
  worldId: overrides.worldId ?? 42,
  regionKey: overrides.regionKey ?? `region-${overrides.id ?? 1}`,
  name: overrides.name ?? 'Region',
  type: overrides.type ?? 'continent',
  description: overrides.description ?? null,
  createdAt: new Date(),
  updatedAt: new Date()
});

const buildTile = (overrides: Partial<WorldHexTile>): WorldHexTile => ({
  id: overrides.id ?? 1,
  worldId: overrides.worldId ?? 42,
  regionId: overrides.regionId ?? 1,
  q: overrides.q ?? 0,
  r: overrides.r ?? 0,
  terrain: overrides.terrain ?? 'land',
  navigable: overrides.navigable ?? true,
  label: overrides.label ?? null,
  createdAt: new Date(),
  updatedAt: new Date()
});

const buildSpawnRegion = (overrides: Partial<WorldSpawnRegion>): WorldSpawnRegion => ({
  id: overrides.id ?? 1,
  worldId: overrides.worldId ?? 42,
  regionId: overrides.regionId ?? 1,
  name: overrides.name ?? 'Spawn Region',
  description: overrides.description ?? null,
  minDistanceFromEdge: overrides.minDistanceFromEdge ?? 2,
  createdAt: new Date(),
  updatedAt: new Date()
});

const createRepository = (data?: {
  definition: WorldDefinition;
  regions: WorldRegion[];
  tiles: WorldHexTile[];
  spawnRegions: WorldSpawnRegion[];
}): Pick<WorldRepository, 'loadWorld'> => {
  const defaultDefinition = buildWorldDefinition();
  const continentA = buildRegion({ id: 100, worldId: defaultDefinition.id, regionKey: 'continent_a' });
  const continentB = buildRegion({ id: 101, worldId: defaultDefinition.id, regionKey: 'continent_b' });
  const ocean = buildRegion({ id: 200, worldId: defaultDefinition.id, regionKey: 'ocean_main', type: 'ocean' });
  const islandChain = buildRegion({
    id: 300,
    worldId: defaultDefinition.id,
    regionKey: 'island_bridge',
    type: 'island_chain'
  });

  const tiles: WorldHexTile[] = [
    buildTile({ id: 1, worldId: defaultDefinition.id, regionId: continentA.id, q: -2, r: 0 }),
    buildTile({ id: 2, worldId: defaultDefinition.id, regionId: continentA.id, q: -1, r: 0, terrain: 'coastal' }),
    buildTile({ id: 3, worldId: defaultDefinition.id, regionId: ocean.id, q: 0, r: 0, terrain: 'ocean', navigable: true }),
    buildTile({ id: 4, worldId: defaultDefinition.id, regionId: islandChain.id, q: 1, r: 0, terrain: 'island' }),
    buildTile({ id: 5, worldId: defaultDefinition.id, regionId: continentB.id, q: 2, r: 0 })
  ];

  const spawnRegions: WorldSpawnRegion[] = [
    buildSpawnRegion({ id: 1, worldId: defaultDefinition.id, regionId: continentA.id })
  ];

  const repositoryData =
    data ?? {
      definition: defaultDefinition,
  regions: [continentA, ocean, islandChain, continentB],
      tiles,
      spawnRegions
    };

  return {
    loadWorld: vi.fn().mockResolvedValue(repositoryData)
  };
};

beforeEach(() => {
  resetWorldModuleForTests();
});

const createDeterministicRng = (values: number[]): (() => number) => {
  let index = 0;
  return () => {
    const value = values[index] ?? values[values.length - 1] ?? 0;
    index += 1;
    return value;
  };
};

describe('world module lookups', () => {
  it('throws when lookups are accessed before load completes', () => {
    expect(() => getHexTile(0, 0)).toThrowError(/World module has not been initialized/);
  });

  it('builds coordinate and region indices on load', async () => {
    const repository = createRepository();

    const state = await loadWorldModule({ repository: repository as WorldRepository, worldKey: 'default' });

    expect(isWorldLoaded()).toBe(true);
    expect(state.lookups).toBeDefined();

    const tile = getHexTile(-2, 0);
    expect(tile).toBeDefined();
    expect(tile?.regionId).toBe(100);

    const region = getRegionByKey('continent_a');
    expect(region).toBeDefined();
    expect(region?.id).toBe(100);

    const regionForTile = getRegionForTile(0, 0);
    expect(regionForTile?.regionKey).toBe('ocean_main');

    const regionTiles = getTilesForRegion('continent_a');
    expect(regionTiles).toHaveLength(2);
    expect(regionTiles.some((t) => t.q === -1 && t.r === 0)).toBe(true);

    expect(listWorldRegions()).toHaveLength(state.regions.length);
    expect(listWorldTiles()).toHaveLength(state.tiles.length);
    expect(listSpawnRegions()).toHaveLength(state.spawnRegions.length);
  });

  it('exposes sanitized metadata for the active world', async () => {
    const repository = createRepository();

    await loadWorldModule({ repository: repository as WorldRepository, worldKey: 'default' });

    const metadata = getWorldMetadata();

    expect(metadata.worldKey).toBe('default');
    expect(metadata.version).toBe(1);
    expect(metadata.name).toBe('Default World');
    expect(metadata.boundaryPolicy).toBe('hard-edge');
    expect(metadata.loadedAt).toBeInstanceOf(Date);
  });

  it('selects spawn hexes using configured regions and optional preferences', async () => {
    const definition = buildWorldDefinition();
    const continentA = buildRegion({ id: 10, worldId: definition.id, regionKey: 'continent_a' });
    const continentB = buildRegion({ id: 11, worldId: definition.id, regionKey: 'continent_b' });
    const ocean = buildRegion({ id: 12, worldId: definition.id, regionKey: 'ocean_main', type: 'ocean' });
    const island = buildRegion({ id: 13, worldId: definition.id, regionKey: 'island_bridge', type: 'island_chain' });

    const tiles: WorldHexTile[] = [
      buildTile({ id: 1, worldId: definition.id, regionId: continentA.id, q: 0, r: 0 }),
      buildTile({ id: 2, worldId: definition.id, regionId: continentB.id, q: 5, r: 5 }),
      buildTile({ id: 3, worldId: definition.id, regionId: island.id, q: 2, r: 1, terrain: 'island' }),
      buildTile({ id: 4, worldId: definition.id, regionId: ocean.id, q: 1, r: 1, terrain: 'ocean', navigable: true })
    ];

    const spawnRegions: WorldSpawnRegion[] = [
      buildSpawnRegion({ id: 1, worldId: definition.id, regionId: continentA.id, name: 'Aurora' }),
      buildSpawnRegion({ id: 2, worldId: definition.id, regionId: continentB.id, name: 'Zephyr' })
    ];

    const repository = createRepository({
      definition,
      regions: [continentA, continentB, ocean, island],
      tiles,
      spawnRegions
    });

    await loadWorldModule({ repository: repository as WorldRepository, worldKey: 'default' });

    const rng = createDeterministicRng([0.9, 0.2]);
    const selection = selectSpawnHex({ preferredRegionKeys: ['continent_b'], rng });

    expect(selection.region.regionKey).toBe('continent_b');
    expect(selection.spawnRegion.name).toBe('Zephyr');
    expect(selection.tile.regionId).toBe(continentB.id);
  });
});
