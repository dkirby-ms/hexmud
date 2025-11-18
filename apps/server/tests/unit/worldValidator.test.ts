import { describe, expect, it } from 'vitest';

import { validateWorldLayout, type WorldValidationInput } from '../../src/world/validator.js';
import type {
  WorldDefinition,
  WorldHexTile,
  WorldRegion,
  WorldSpawnRegion
} from '../../src/world/types.js';

const buildWorldDefinition = (): WorldDefinition => ({
  id: 1,
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
  worldId: overrides.worldId ?? 1,
  regionKey: overrides.regionKey ?? `region-${overrides.id ?? 1}`,
  name: overrides.name ?? 'Region',
  type: overrides.type ?? 'continent',
  description: overrides.description ?? null,
  createdAt: overrides.createdAt ?? new Date(),
  updatedAt: overrides.updatedAt ?? new Date()
});

const buildTile = (overrides: Partial<WorldHexTile>): WorldHexTile => ({
  id: overrides.id ?? 1,
  worldId: overrides.worldId ?? 1,
  regionId: overrides.regionId ?? 1,
  q: overrides.q ?? 0,
  r: overrides.r ?? 0,
  terrain: overrides.terrain ?? 'land',
  navigable: overrides.navigable ?? true,
  label: overrides.label ?? null,
  createdAt: overrides.createdAt ?? new Date(),
  updatedAt: overrides.updatedAt ?? new Date()
});

const buildSpawnRegion = (overrides: Partial<WorldSpawnRegion>): WorldSpawnRegion => ({
  id: overrides.id ?? 1,
  worldId: overrides.worldId ?? 1,
  regionId: overrides.regionId ?? 1,
  name: overrides.name ?? 'Spawn',
  description: overrides.description ?? null,
  minDistanceFromEdge: overrides.minDistanceFromEdge ?? 1,
  createdAt: overrides.createdAt ?? new Date(),
  updatedAt: overrides.updatedAt ?? new Date()
});

const createValidWorldInput = (): WorldValidationInput => {
  const definition = buildWorldDefinition();
  const continentA = buildRegion({ id: 10, worldId: definition.id, regionKey: 'continent_a' });
  const continentB = buildRegion({ id: 11, worldId: definition.id, regionKey: 'continent_b' });
  const ocean = buildRegion({ id: 12, worldId: definition.id, regionKey: 'ocean_main', type: 'ocean' });
  const islandChain = buildRegion({
    id: 13,
    worldId: definition.id,
    regionKey: 'island_chain',
    type: 'island_chain'
  });

  const tiles: WorldHexTile[] = [
    buildTile({ id: 1, worldId: definition.id, regionId: continentA.id, q: -2, r: 0, terrain: 'land' }),
    buildTile({ id: 2, worldId: definition.id, regionId: continentA.id, q: -1, r: 0, terrain: 'coastal' }),
    buildTile({ id: 3, worldId: definition.id, regionId: ocean.id, q: 0, r: 0, terrain: 'ocean' }),
    buildTile({ id: 4, worldId: definition.id, regionId: ocean.id, q: 0, r: 1, terrain: 'blocked', navigable: false }),
    buildTile({ id: 5, worldId: definition.id, regionId: islandChain.id, q: 1, r: 1, terrain: 'island' }),
    buildTile({ id: 6, worldId: definition.id, regionId: continentB.id, q: 2, r: 1, terrain: 'land' })
  ];

  const spawnRegions: WorldSpawnRegion[] = [
    buildSpawnRegion({ id: 1, worldId: definition.id, regionId: continentA.id, name: 'Aurora Landing' }),
    buildSpawnRegion({ id: 2, worldId: definition.id, regionId: continentB.id, name: 'Zephyr Outpost' })
  ];

  return {
    definition,
    regions: [continentA, ocean, islandChain, continentB],
    tiles,
    spawnRegions
  };
};

describe('validateWorldLayout', () => {
  it('accepts a valid default world layout', () => {
    const input = createValidWorldInput();
    const result = validateWorldLayout(input);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails when fewer than two continents exist', () => {
    const input = createValidWorldInput();
    input.regions = input.regions.filter((region) => region.regionKey !== 'continent_b');
    input.tiles = input.tiles.filter((tile) =>
      input.regions.some((region) => region.id === tile.regionId)
    );
    input.spawnRegions = input.spawnRegions.filter((spawn) => spawn.regionId !== 11);

    const result = validateWorldLayout(input);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('world.regions.continent.minimum');
  });

  it('fails when spawn regions do not include a continent', () => {
    const input = createValidWorldInput();
    const islandRegion = input.regions.find((region) => region.type === 'island_chain');
    if (!islandRegion) {
      throw new Error('island region missing from test setup');
    }
    input.spawnRegions = [
      buildSpawnRegion({ id: 3, worldId: input.definition.id, regionId: islandRegion.id, name: 'Island Spawn' })
    ];

    const result = validateWorldLayout(input);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('world.spawn_regions.no_continent_region');
  });

  it('detects duplicate hex coordinates', () => {
    const input = createValidWorldInput();
    const duplicateOf = input.tiles[0];
    input.tiles.push({ ...duplicateOf!, id: 999 });

    const result = validateWorldLayout(input);
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.startsWith('world.tiles.duplicate_coordinate'))).toBe(true);
  });
});
