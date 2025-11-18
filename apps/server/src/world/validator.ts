import type {
  TerrainType,
  WorldDefinition,
  WorldHexTile,
  WorldRegion,
  WorldSpawnRegion
} from './types.js';

export interface WorldValidationInput {
  definition: WorldDefinition;
  regions: WorldRegion[];
  tiles: WorldHexTile[];
  spawnRegions: WorldSpawnRegion[];
}

export interface WorldValidationResult {
  ok: boolean;
  errors: string[];
}

interface RegionStats {
  totalTiles: number;
  navigableTiles: number;
  terrainCounts: Record<TerrainType, number>;
}

const createRegionStats = (): RegionStats => ({
  totalTiles: 0,
  navigableTiles: 0,
  terrainCounts: {
    land: 0,
    ocean: 0,
    coastal: 0,
    island: 0,
    blocked: 0
  }
});

const formatDetail = (code: string, detail?: string): string =>
  detail ? `${code}:${detail}` : code;

const isTerrainAllowedForRegion = (regionType: WorldRegion['type'], terrain: TerrainType): boolean => {
  if (regionType === 'continent') {
    return terrain === 'land' || terrain === 'coastal';
  }
  if (regionType === 'ocean') {
    return terrain === 'ocean' || terrain === 'blocked';
  }
  if (regionType === 'island_chain') {
    return terrain === 'island' || terrain === 'coastal' || terrain === 'land';
  }
  return true;
};

export const validateWorldLayout = ({
  definition,
  regions,
  tiles,
  spawnRegions
}: WorldValidationInput): WorldValidationResult => {
  // Detailed validation rules will be implemented as part of User Story 1 (T013).
  // For now, ensure the fundamental collections are non-empty to fail fast if schema data is missing.
  const errors: string[] = [];

  if (!definition) {
    errors.push('world.definition.missing');
  }
  if (regions.length === 0) {
    errors.push('world.regions.empty');
  }
  if (tiles.length === 0) {
    errors.push('world.tiles.empty');
  }
  if (spawnRegions.length === 0) {
    errors.push('world.spawn_regions.empty');
  }

  if (!definition) {
    return {
      ok: false,
      errors
    };
  }

  if (definition.boundaryPolicy !== 'hard-edge') {
    errors.push(formatDetail('world.definition.boundary_policy.unsupported', definition.boundaryPolicy));
  }

  const worldId = definition.id;
  const regionById = new Map<number, WorldRegion>();
  const regionStats = new Map<number, RegionStats>();
  const coordinateSet = new Set<string>();
  const regionTypeCounts: Record<WorldRegion['type'], number> = {
    continent: 0,
    ocean: 0,
    island_chain: 0,
    other: 0
  };

  for (const region of regions) {
    regionById.set(region.id, region);
    regionStats.set(region.id, createRegionStats());
    regionTypeCounts[region.type] += 1;
    if (region.worldId !== worldId) {
      errors.push(formatDetail('world.regions.mismatched_world', region.regionKey));
    }
  }

  for (const tile of tiles) {
    const coordinateKey = `${tile.q},${tile.r}`;
    if (coordinateSet.has(coordinateKey)) {
      errors.push(formatDetail('world.tiles.duplicate_coordinate', coordinateKey));
    } else {
      coordinateSet.add(coordinateKey);
    }

    if (tile.worldId !== worldId) {
      errors.push(formatDetail('world.tiles.mismatched_world', coordinateKey));
    }

    const region = regionById.get(tile.regionId);
    if (!region) {
      errors.push(formatDetail('world.tiles.region_missing', coordinateKey));
      continue;
    }

    const stats = regionStats.get(region.id);
    if (!stats) {
      continue;
    }

    stats.totalTiles += 1;
    if (tile.navigable) {
      stats.navigableTiles += 1;
    }
    stats.terrainCounts[tile.terrain] += 1;

    if (!isTerrainAllowedForRegion(region.type, tile.terrain)) {
      errors.push(formatDetail('world.tiles.terrain_invalid', `${region.regionKey}:${coordinateKey}`));
    }
  }

  for (const region of regions) {
    const stats = regionStats.get(region.id) ?? createRegionStats();
    if (stats.totalTiles === 0) {
      errors.push(formatDetail('world.regions.no_tiles', region.regionKey));
    }
    if (region.type !== 'ocean' && stats.navigableTiles === 0) {
      errors.push(formatDetail('world.regions.no_navigable_tiles', region.regionKey));
    }
    if (region.type === 'continent' && stats.terrainCounts.land === 0) {
      errors.push(formatDetail('world.continent.land_tiles.missing', region.regionKey));
    }
    if (region.type === 'island_chain' && stats.terrainCounts.island === 0) {
      errors.push(formatDetail('world.island_chain.island_tiles.missing', region.regionKey));
    }
    if (region.type === 'ocean' && stats.terrainCounts.ocean === 0) {
      errors.push(formatDetail('world.ocean.ocean_tiles.missing', region.regionKey));
    }
  }

  if (regionTypeCounts.continent < 2) {
    errors.push('world.regions.continent.minimum');
  }
  if (regionTypeCounts.ocean < 1) {
    errors.push('world.regions.ocean.minimum');
  }
  if (regionTypeCounts.island_chain < 1) {
    errors.push('world.regions.island_chain.minimum');
  }

  const spawnRegionsByRegion = spawnRegions.map((spawnRegion) => {
    const region = regionById.get(spawnRegion.regionId);
    if (!region) {
      errors.push(formatDetail('world.spawn_regions.region_missing', spawnRegion.name));
      return null;
    }
    if (spawnRegion.worldId !== worldId) {
      errors.push(formatDetail('world.spawn_regions.mismatched_world', spawnRegion.name));
    }
    if (region.worldId !== spawnRegion.worldId) {
      errors.push(formatDetail('world.spawn_regions.region_mismatch', spawnRegion.name));
    }
    return region;
  });

  let spawnRegionOnContinent = false;
  for (const region of spawnRegionsByRegion) {
    if (!region) {
      continue;
    }
    if (region.type === 'ocean') {
      errors.push(formatDetail('world.spawn_regions.ocean_not_allowed', region.regionKey));
    }
    if (region.type === 'continent') {
      spawnRegionOnContinent = true;
    }
    const stats = regionStats.get(region.id);
    if (!stats || stats.navigableTiles === 0) {
      errors.push(formatDetail('world.spawn_regions.no_navigable_tiles', region.regionKey));
    }
  }

  if (!spawnRegionOnContinent) {
    errors.push('world.spawn_regions.no_continent_region');
  }

  const navigableOceanTiles = tiles.filter((tile) => tile.navigable && tile.terrain === 'ocean').length;
  if (navigableOceanTiles === 0) {
    errors.push('world.ocean.navigable_tiles.missing');
  }

  const navigableIslandTiles = tiles.filter((tile) => tile.navigable && tile.terrain === 'island').length;
  if (regionTypeCounts.island_chain > 0 && navigableIslandTiles === 0) {
    errors.push('world.island_chain.navigable_tiles.missing');
  }

  return {
    ok: errors.length === 0,
    errors
  };
};
