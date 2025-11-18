import type { Request, Response } from 'express';

import { getWorldState, isWorldLoaded } from '../../world/index.js';

import { respondWorldNotReady } from './shared.js';

export const handleListSpawnRegions = (_req: Request, res: Response): void => {
  if (!isWorldLoaded()) {
    respondWorldNotReady(res);
    return;
  }

  const state = getWorldState();
  const payload = state.spawnRegions.map((spawnRegion) => ({
    name: spawnRegion.name,
    description: spawnRegion.description,
    minDistanceFromEdge: spawnRegion.minDistanceFromEdge,
    regionKey: state.lookups.regionById.get(spawnRegion.regionId)?.regionKey ?? 'unknown'
  }));

  res.json(payload);
};
