import { afterEach, describe, expect, it, vi } from 'vitest';

import type { WorldDataSnapshot, WorldDataSource } from '../../../src/world/repository.js';
import type { WorldSpawnRegion } from '../../../src/world/types.js';
import {
  getHexTile,
  getRegionForTile,
  loadWorldModule,
  resetWorldModuleForTests,
  selectSpawnHex
} from '../../../src/world/index.js';
import { validateWorldLayout } from '../../../src/world/validator.js';
import type { Logger } from '../../../src/logging/logger.js';

interface WorldFixtureOptions {
  worldKey?: string;
}

const createWorldFixture = (options: WorldFixtureOptions = {}): WorldDataSnapshot => {
  const worldKey = options.worldKey ?? 'default';
  const definition = {
    id: 1,
    worldKey,
    name: 'Default World',
    description: 'Fixture world',
    version: 1,
    boundaryPolicy: 'hard-edge' as const,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z')
  };

  const regions = [
    {
      id: 10,
      worldId: definition.id,
      regionKey: 'continent_a',
      name: 'Continent A',
      type: 'continent' as const,
      description: null,
      createdAt: new Date('2025-01-01T00:00:00Z'),
      updatedAt: new Date('2025-01-01T00:00:00Z')
    },
    {
      id: 20,
      worldId: definition.id,
      regionKey: 'continent_b',
      name: 'Continent B',
      type: 'continent' as const,
      description: null,
      createdAt: new Date('2025-01-01T00:00:00Z'),
      updatedAt: new Date('2025-01-01T00:00:00Z')
    },
    {
      id: 30,
      worldId: definition.id,
      regionKey: 'ocean_main',
      name: 'Main Ocean',
      type: 'ocean' as const,
      description: null,
      createdAt: new Date('2025-01-01T00:00:00Z'),
      updatedAt: new Date('2025-01-01T00:00:00Z')
    },
    {
      id: 40,
      worldId: definition.id,
      regionKey: 'island_chain_alpha',
      name: 'Island Chain Alpha',
      type: 'island_chain' as const,
      description: null,
      createdAt: new Date('2025-01-01T00:00:00Z'),
      updatedAt: new Date('2025-01-01T00:00:00Z')
    }
  ];

  const tiles = [
    { id: 100, worldId: definition.id, regionId: 10, q: 0, r: 0, terrain: 'land' as const, navigable: true, label: 'A1', createdAt: new Date(), updatedAt: new Date() },
    { id: 101, worldId: definition.id, regionId: 10, q: 1, r: 0, terrain: 'coastal' as const, navigable: true, label: null, createdAt: new Date(), updatedAt: new Date() },
    { id: 200, worldId: definition.id, regionId: 20, q: 10, r: 10, terrain: 'land' as const, navigable: true, label: 'B1', createdAt: new Date(), updatedAt: new Date() },
    { id: 201, worldId: definition.id, regionId: 20, q: 11, r: 10, terrain: 'coastal' as const, navigable: true, label: null, createdAt: new Date(), updatedAt: new Date() },
  { id: 300, worldId: definition.id, regionId: 30, q: 5, r: 5, terrain: 'ocean' as const, navigable: true, label: null, createdAt: new Date(), updatedAt: new Date() },
    { id: 301, worldId: definition.id, regionId: 30, q: 6, r: 5, terrain: 'blocked' as const, navigable: false, label: null, createdAt: new Date(), updatedAt: new Date() },
    { id: 400, worldId: definition.id, regionId: 40, q: 3, r: 3, terrain: 'island' as const, navigable: true, label: 'Island Alpha', createdAt: new Date(), updatedAt: new Date() }
  ];

  const spawnRegions = [
    {
      id: 500,
      worldId: definition.id,
      regionId: 10,
      name: 'Continent A Spawn',
      description: 'Safe spawn on continent A',
      minDistanceFromEdge: 2,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  return {
    definition,
    regions,
    tiles,
    spawnRegions
  };
};

class StubWorldRepository implements WorldDataSource {
  constructor(private readonly snapshot: WorldDataSnapshot | null) {}

  async loadWorld(_worldKey: string): Promise<WorldDataSnapshot | null> {
    return this.snapshot;
  }
}

const createTestLogger = (): Logger => ({
  trace: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
});

afterEach(() => {
  resetWorldModuleForTests();
});

describe('validateWorldLayout', () => {
  it('passes for a well-formed default world snapshot', () => {
    const snapshot = createWorldFixture();
    const result = validateWorldLayout(snapshot);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('fails when spawn regions reference ocean tiles', () => {
    const snapshot = createWorldFixture();
    const invalidSpawn: WorldSpawnRegion = { ...snapshot.spawnRegions[0]!, regionId: 30 };
    const result = validateWorldLayout({
      ...snapshot,
      spawnRegions: [invalidSpawn]
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('world.spawn_regions.ocean_not_allowed:ocean_main');
  });
});

describe('loadWorldModule + helpers', () => {
  it('loads the world snapshot and exposes lookup helpers', async () => {
    const snapshot = createWorldFixture();
    const repository = new StubWorldRepository(snapshot);
    const logger = createTestLogger();

    const state = await loadWorldModule({ repository, worldKey: 'default', logger });
    expect(state.definition.worldKey).toBe('default');

    const tile = getHexTile(0, 0);
    expect(tile).toBeDefined();
    expect(tile?.regionId).toBe(snapshot.regions[0]?.id);

    const region = getRegionForTile(0, 0);
    expect(region?.regionKey).toBe('continent_a');

    expect(logger.info).toHaveBeenCalledWith('world.default.load.start', expect.any(Object));
    expect(logger.info).toHaveBeenCalledWith(
      'world.default.load.success',
      expect.objectContaining({ version: snapshot.definition.version })
    );
  });

  it('throws when repository does not return a snapshot', async () => {
    const repository = new StubWorldRepository(null);
    await expect(
      loadWorldModule({ repository, worldKey: 'default', logger: createTestLogger() })
    ).rejects.toThrow('World definition not found');
  });
});

describe('selectSpawnHex', () => {
  it('returns a tile within preferred regions', async () => {
    const snapshot = createWorldFixture();
    const repository = new StubWorldRepository(snapshot);
    await loadWorldModule({ repository, worldKey: 'default', logger: createTestLogger() });

    const selection = selectSpawnHex({ preferredRegionKeys: ['continent_a'], rng: () => 0 });
    expect(selection.region.regionKey).toBe('continent_a');
    expect(selection.tile.navigable).toBe(true);
    expect(selection.spawnRegion.name).toBe('Continent A Spawn');
  });

  it('throws when preferred regions have no spawn entries', async () => {
    const snapshot = createWorldFixture();
    const repository = new StubWorldRepository(snapshot);
    await loadWorldModule({ repository, worldKey: 'default', logger: createTestLogger() });

    expect(() =>
      selectSpawnHex({ preferredRegionKeys: ['continent_b'], rng: () => 0 })
    ).toThrow('No spawn regions available for preferred keys: continent_b');
  });
});
