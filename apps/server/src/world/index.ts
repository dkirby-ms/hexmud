import { performance } from 'node:perf_hooks';

import {
  logWorldLoadFailure,
  logWorldLoadStart,
  logWorldLoadSuccess,
  logWorldValidationError
} from '../logging/events.js';
import type { Logger } from '../logging/logger.js';
import { logger as defaultLogger } from '../logging/logger.js';
import { recordWorldLoadFailure, recordWorldLoadSuccess, recordWorldValidationError } from '../metrics/world.js';

import type { WorldDataSnapshot, WorldDataSource } from './repository.js';
import type {
  BoundaryPolicy,
  WorldDefinition,
  WorldHexTile,
  WorldRegion,
  WorldSpawnRegion
} from './types.js';
import { serializeCoordinate } from './types.js';
import { validateWorldLayout } from './validator.js';

export interface WorldModuleOptions {
  repository: WorldDataSource;
  worldKey: string;
  logger?: Logger;
}

interface WorldLookups {
  coordinateIndex: Map<string, WorldHexTile>;
  tilesByRegionId: Map<number, WorldHexTile[]>;
  regionById: Map<number, WorldRegion>;
  regionByKey: Map<string, WorldRegion>;
  spawnRegionsByRegionId: Map<number, WorldSpawnRegion[]>;
}

interface SpawnRegionCandidate {
  region: WorldRegion;
  spawnRegion: WorldSpawnRegion;
  tiles: WorldHexTile[];
}

export interface SpawnSelectionOptions {
  /** Optional list of region keys (e.g., continent identifiers) to restrict the spawn search. */
  preferredRegionKeys?: string[];
  /** Optional random number generator that returns a float in [0, 1). Defaults to Math.random. */
  rng?: () => number;
}

export interface SpawnSelectionResult {
  tile: WorldHexTile;
  region: WorldRegion;
  spawnRegion: WorldSpawnRegion;
}

export interface WorldState {
  definition: WorldDefinition;
  regions: WorldRegion[];
  tiles: WorldHexTile[];
  spawnRegions: WorldSpawnRegion[];
  loadedAt: Date;
  lookups: WorldLookups;
}

export interface WorldMetadata {
  worldKey: string;
  name: string;
  description: string | null;
  version: number;
  boundaryPolicy: BoundaryPolicy;
  loadedAt: Date;
}

let worldState: WorldState | null = null;

const buildLookups = (
  regions: WorldRegion[],
  tiles: WorldHexTile[],
  spawnRegions: WorldSpawnRegion[]
): WorldLookups => {
  const tilesByRegionId = new Map<number, WorldHexTile[]>();
  const coordinateIndex = new Map<string, WorldHexTile>();
  const regionById = new Map<number, WorldRegion>();
  const regionByKey = new Map<string, WorldRegion>();
  const spawnRegionsByRegionId = new Map<number, WorldSpawnRegion[]>();

  for (const region of regions) {
    regionById.set(region.id, region);
    regionByKey.set(region.regionKey, region);
    tilesByRegionId.set(region.id, []);
  }

  for (const tile of tiles) {
    const key = serializeCoordinate(tile);
    coordinateIndex.set(key, tile);
    const regionTiles = tilesByRegionId.get(tile.regionId);
    if (regionTiles) {
      regionTiles.push(tile);
    } else {
      tilesByRegionId.set(tile.regionId, [tile]);
    }
  }

  for (const spawnRegion of spawnRegions) {
    const group = spawnRegionsByRegionId.get(spawnRegion.regionId);
    if (group) {
      group.push(spawnRegion);
    } else {
      spawnRegionsByRegionId.set(spawnRegion.regionId, [spawnRegion]);
    }
  }

  return {
    coordinateIndex,
    tilesByRegionId,
    regionById,
    regionByKey,
    spawnRegionsByRegionId
  };
};

const requireWorldState = (): WorldState => {
  if (!worldState) {
    throw new Error('World module has not been initialized. Call loadWorldModule() first.');
  }
  return worldState;
};

export const loadWorldModule = async ({
  repository,
  worldKey,
  logger = defaultLogger
}: WorldModuleOptions): Promise<WorldState> => {
  const start = performance.now();
  logger.info('world.default.load.start', logWorldLoadStart({ worldKey }));

  let snapshot: WorldDataSnapshot | null = null;
  try {
    snapshot = await repository.loadWorld(worldKey);
  } catch (error) {
    const durationMs = performance.now() - start;
    logger.error(
      'world.default.load.failure',
      logWorldLoadFailure({
        worldKey,
        reason: 'unexpected_error',
        durationMs,
        phase: 'definition',
        error: error instanceof Error ? error.message : String(error)
      })
    );
    recordWorldLoadFailure({
      worldKey,
      reason: 'unexpected_error',
      durationMs,
      phase: 'definition'
    });
    throw error;
  }

  if (!snapshot) {
    const durationMs = performance.now() - start;
    logger.error(
      'world.default.load.failure',
      logWorldLoadFailure({
        worldKey,
        reason: 'world_definition_not_found',
        durationMs,
        phase: 'definition'
      })
    );
    recordWorldLoadFailure({
      worldKey,
      reason: 'world_definition_not_found',
      durationMs,
      phase: 'definition'
    });
    throw new Error(`World definition not found for key "${worldKey}"`);
  }

  const validationStart = performance.now();
  const validation = validateWorldLayout(snapshot);
  const validationDurationMs = performance.now() - validationStart;
  if (!validation.ok) {
    const durationMs = performance.now() - start;
    logger.error(
      'world.default.validation.error',
      logWorldValidationError({ worldKey, errors: validation.errors, durationMs: validationDurationMs })
    );
    logger.error(
      'world.default.load.failure',
      logWorldLoadFailure({
        worldKey,
        reason: 'validation_failed',
        durationMs,
        phase: 'validation',
        validationErrorCount: validation.errors.length
      })
    );
    recordWorldValidationError({
      worldKey,
      errorCount: validation.errors.length,
      durationMs: validationDurationMs
    });
    recordWorldLoadFailure({
      worldKey,
      reason: 'validation_failed',
      durationMs,
      phase: 'validation',
      validationErrorCount: validation.errors.length
    });
    throw new Error(`Default world validation failed: ${validation.errors.join(', ')}`);
  }

  worldState = {
    definition: snapshot.definition,
    regions: snapshot.regions,
    tiles: snapshot.tiles,
    spawnRegions: snapshot.spawnRegions,
    loadedAt: new Date(),
    lookups: buildLookups(snapshot.regions, snapshot.tiles, snapshot.spawnRegions)
  };

  const durationMs = performance.now() - start;

  logger.info(
    'world.default.load.success',
    logWorldLoadSuccess({
      worldKey: snapshot.definition.worldKey,
      version: snapshot.definition.version,
      tileCount: snapshot.tiles.length,
      regionCount: snapshot.regions.length,
      spawnRegionCount: snapshot.spawnRegions.length,
      durationMs,
      validationDurationMs
    })
  );

  recordWorldLoadSuccess({
    worldKey: snapshot.definition.worldKey,
    durationMs,
    validationDurationMs,
    regionCount: snapshot.regions.length,
    tileCount: snapshot.tiles.length,
    spawnRegionCount: snapshot.spawnRegions.length
  });

  return worldState;
};

export const getWorldState = (): WorldState => {
  return requireWorldState();
};

export const getWorldMetadata = (): WorldMetadata => {
  const state = requireWorldState();
  const { worldKey, name, description, version, boundaryPolicy } = state.definition;
  return {
    worldKey,
    name,
    description,
    version,
    boundaryPolicy,
    loadedAt: state.loadedAt
  };
};

export const isWorldLoaded = (): boolean => worldState !== null;

export const getHexTile = (q: number, r: number): WorldHexTile | undefined => {
  const state = requireWorldState();
  return state.lookups.coordinateIndex.get(serializeCoordinate({ q, r }));
};

export const getRegionByKey = (regionKey: string): WorldRegion | undefined => {
  const state = requireWorldState();
  return state.lookups.regionByKey.get(regionKey);
};

export const getRegionForTile = (q: number, r: number): WorldRegion | undefined => {
  const tile = getHexTile(q, r);
  if (!tile) {
    return undefined;
  }
  const state = requireWorldState();
  return state.lookups.regionById.get(tile.regionId);
};

export const getTilesForRegion = (regionKey: string): WorldHexTile[] => {
  const state = requireWorldState();
  const region = state.lookups.regionByKey.get(regionKey);
  if (!region) {
    return [];
  }
  return state.lookups.tilesByRegionId.get(region.id) ?? [];
};

export const listWorldRegions = (): WorldRegion[] => requireWorldState().regions;

export const listWorldTiles = (): WorldHexTile[] => requireWorldState().tiles;

export const listSpawnRegions = (): WorldSpawnRegion[] => requireWorldState().spawnRegions;

const pickRandom = <T>(items: readonly T[], rng: () => number): T => {
  if (items.length === 0) {
    throw new Error('Cannot select a random item from an empty collection.');
  }
  const index = Math.floor(rng() * items.length);
  const boundedIndex = index >= items.length ? items.length - 1 : index;
  return items[boundedIndex]!;
};

const collectSpawnRegionCandidates = (
  state: WorldState,
  preferredRegionKeys?: Set<string>
): SpawnRegionCandidate[] => {
  const allowedRegionIds = preferredRegionKeys
    ? new Set(
        Array.from(preferredRegionKeys)
          .map((key) => state.lookups.regionByKey.get(key)?.id)
          .filter((value): value is number => typeof value === 'number')
      )
    : null;

  const candidates: SpawnRegionCandidate[] = [];
  for (const [regionId, spawnRegions] of state.lookups.spawnRegionsByRegionId.entries()) {
    if (allowedRegionIds && !allowedRegionIds.has(regionId)) {
      continue;
    }

    const region = state.lookups.regionById.get(regionId);
    if (!region) {
      continue;
    }

    const navigableTiles = (state.lookups.tilesByRegionId.get(regionId) ?? []).filter(
      (tile) => tile.navigable
    );
    if (navigableTiles.length === 0) {
      continue;
    }

    for (const spawnRegion of spawnRegions) {
      candidates.push({ region, spawnRegion, tiles: navigableTiles });
    }
  }

  return candidates;
};

export const selectSpawnHex = (options: SpawnSelectionOptions = {}): SpawnSelectionResult => {
  const state = requireWorldState();
  const { preferredRegionKeys, rng = Math.random } = options;

  const preferredSet = preferredRegionKeys && preferredRegionKeys.length > 0 ? new Set(preferredRegionKeys) : undefined;
  const candidates = collectSpawnRegionCandidates(state, preferredSet);

  if (candidates.length === 0) {
    if (preferredSet && preferredSet.size > 0) {
      throw new Error(
        `No spawn regions available for preferred keys: ${Array.from(preferredSet.values()).join(', ')}`
      );
    }
    throw new Error('No spawn regions with navigable tiles are configured for the default world.');
  }

  const selectedRegion = pickRandom(candidates, rng);
  const tile = pickRandom(selectedRegion.tiles, rng);

  return {
    tile,
    region: selectedRegion.region,
    spawnRegion: selectedRegion.spawnRegion
  };
};

export const resetWorldModuleForTests = (): void => {
  worldState = null;
};
