import type { WorldRepository } from '../../src/world/repository.js';
import { loadWorldModule, resetWorldModuleForTests } from '../../src/world/index.js';
import type {
  TerrainType,
  WorldDefinition,
  WorldHexTile,
  WorldRegion,
  WorldSpawnRegion
} from '../../src/world/types.js';

interface CoordinateConfig {
  q: number;
  r: number;
  regionKey: WorldRegion['regionKey'];
  terrain?: TerrainType;
  navigable?: boolean;
}

interface TestWorldOptions {
  extraCoordinates?: CoordinateConfig[];
}

const now = () => new Date();

const buildRegion = (overrides: Partial<WorldRegion>): WorldRegion => ({
  id: overrides.id ?? 0,
  worldId: overrides.worldId ?? 0,
  regionKey: overrides.regionKey ?? 'region',
  name: overrides.name ?? overrides.regionKey ?? 'Region',
  type: overrides.type ?? 'continent',
  description: overrides.description ?? null,
  createdAt: overrides.createdAt ?? now(),
  updatedAt: overrides.updatedAt ?? now()
});

const buildTile = (overrides: Partial<WorldHexTile>): WorldHexTile => ({
  id: overrides.id ?? 0,
  worldId: overrides.worldId ?? 0,
  regionId: overrides.regionId ?? 0,
  q: overrides.q ?? 0,
  r: overrides.r ?? 0,
  terrain: overrides.terrain ?? 'land',
  navigable: overrides.navigable ?? true,
  label: overrides.label ?? null,
  createdAt: overrides.createdAt ?? now(),
  updatedAt: overrides.updatedAt ?? now()
});

const regionTypeDefaults: Record<WorldRegion['type'], TerrainType> = {
  continent: 'land',
  ocean: 'ocean',
  island_chain: 'island',
  other: 'land'
};

const createCoordinateTiles = (
  coords: CoordinateConfig[],
  regionsByKey: Map<string, WorldRegion>,
  worldId: number,
  startingId: number
): WorldHexTile[] => {
  let nextId = startingId;
  return coords.map((coord) => {
    const region = regionsByKey.get(coord.regionKey);
    if (!region) {
      throw new Error(`Unknown region key: ${coord.regionKey}`);
    }
    return buildTile({
      id: nextId++,
      worldId,
      regionId: region.id,
      q: coord.q,
      r: coord.r,
      terrain: coord.terrain ?? regionTypeDefaults[region.type],
      navigable: coord.navigable ?? true
    });
  });
};

export const loadTestWorld = async (options: TestWorldOptions = {}): Promise<void> => {
  resetWorldModuleForTests();

  const definition: WorldDefinition = {
    id: 1,
    worldKey: 'default',
    name: 'Test World',
    description: 'Test world for unit and integration tests',
    version: 1,
    boundaryPolicy: 'hard-edge',
    createdAt: now(),
    updatedAt: now()
  };

  const continentA = buildRegion({ id: 100, worldId: definition.id, regionKey: 'continent_a' });
  const continentB = buildRegion({ id: 101, worldId: definition.id, regionKey: 'continent_b' });
  const ocean = buildRegion({ id: 102, worldId: definition.id, regionKey: 'ocean_main', type: 'ocean' });
  const island = buildRegion({
    id: 103,
    worldId: definition.id,
    regionKey: 'island_chain_mistral',
    type: 'island_chain'
  });

  const regions = [continentA, continentB, ocean, island];
  const regionsByKey = new Map(regions.map((region) => [region.regionKey, region] as const));

  const defaultWorldCoordinates: CoordinateConfig[] = [
    // Continent A
    { q: -4, r: 0, regionKey: 'continent_a', terrain: 'land' },
    { q: -4, r: 1, regionKey: 'continent_a', terrain: 'land' },
    { q: -3, r: -1, regionKey: 'continent_a', terrain: 'land' },
    { q: -3, r: 0, regionKey: 'continent_a', terrain: 'land' },
    { q: -3, r: 1, regionKey: 'continent_a', terrain: 'coastal' },
    { q: -2, r: -2, regionKey: 'continent_a', terrain: 'land' },
    { q: -2, r: -1, regionKey: 'continent_a', terrain: 'land' },
    { q: -2, r: 0, regionKey: 'continent_a', terrain: 'coastal' },
    { q: -1, r: -2, regionKey: 'continent_a', terrain: 'coastal' },
    // Ocean main with hard-edge samples
    { q: -1, r: -1, regionKey: 'ocean_main', terrain: 'ocean' },
    { q: -1, r: 0, regionKey: 'ocean_main', terrain: 'ocean' },
    { q: -1, r: 1, regionKey: 'ocean_main', terrain: 'ocean' },
    { q: 0, r: -1, regionKey: 'ocean_main', terrain: 'ocean' },
    { q: 0, r: 0, regionKey: 'ocean_main', terrain: 'blocked', navigable: false },
    { q: 0, r: 1, regionKey: 'ocean_main', terrain: 'ocean' },
    { q: 1, r: -3, regionKey: 'ocean_main', terrain: 'ocean' },
    { q: 1, r: -2, regionKey: 'ocean_main', terrain: 'ocean' },
    { q: 1, r: -1, regionKey: 'ocean_main', terrain: 'ocean' },
    { q: 1, r: 0, regionKey: 'ocean_main', terrain: 'ocean', navigable: false },
    // Mistral Isles
    { q: 1, r: 1, regionKey: 'island_chain_mistral', terrain: 'island' },
    { q: 2, r: 2, regionKey: 'island_chain_mistral', terrain: 'island' },
    { q: 1, r: 2, regionKey: 'island_chain_mistral', terrain: 'coastal' },
    // Continent B
    { q: 2, r: -1, regionKey: 'continent_b', terrain: 'coastal' },
    { q: 2, r: 0, regionKey: 'continent_b', terrain: 'land' },
    { q: 2, r: 1, regionKey: 'continent_b', terrain: 'land' },
    { q: 3, r: -1, regionKey: 'continent_b', terrain: 'coastal' },
    { q: 3, r: 0, regionKey: 'continent_b', terrain: 'land' },
    { q: 3, r: 1, regionKey: 'continent_b', terrain: 'land' },
    { q: 4, r: -1, regionKey: 'continent_b', terrain: 'land' },
    { q: 4, r: 0, regionKey: 'continent_b', terrain: 'land' },
    { q: 4, r: 1, regionKey: 'continent_b', terrain: 'coastal' },
    { q: 5, r: 0, regionKey: 'continent_b', terrain: 'land' },
    { q: 5, r: -1, regionKey: 'continent_b', terrain: 'coastal' }
  ];

  const legacyTestCoordinates: CoordinateConfig[] = [
    { q: 2, r: 3, regionKey: 'continent_a' },
    { q: 5, r: 5, regionKey: 'continent_a' },
    { q: 5, r: 7, regionKey: 'continent_a' },
    { q: 7, r: 7, regionKey: 'continent_a' },
    { q: 9, r: 9, regionKey: 'continent_a' },
    { q: 10, r: 10, regionKey: 'continent_a' },
    { q: 11, r: 10, regionKey: 'continent_a' },
    { q: 20, r: 20, regionKey: 'continent_b' },
    { q: 3, r: 2, regionKey: 'island_chain_mistral', terrain: 'island', navigable: true }
  ];

  const allCoordinates = [
    ...defaultWorldCoordinates,
    ...legacyTestCoordinates,
    ...(options.extraCoordinates ?? [])
  ];
  const tiles = createCoordinateTiles(allCoordinates, regionsByKey, definition.id, 1000);

  const spawnRegions: WorldSpawnRegion[] = [
    {
      id: 500,
      worldId: definition.id,
      regionId: continentA.id,
      name: 'Aurora Landing',
      description: 'Default spawn region on Continent A',
      minDistanceFromEdge: 2,
      createdAt: now(),
      updatedAt: now()
    }
  ];

  const worldData = {
    definition,
    regions,
    tiles,
    spawnRegions
  };

  const repository: Pick<WorldRepository, 'loadWorld'> = {
    loadWorld: async () => worldData
  };

  await loadWorldModule({
    repository: repository as WorldRepository,
    worldKey: definition.worldKey
  });
};