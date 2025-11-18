import type { Request, Response } from 'express';

import { getWorldState, isWorldLoaded } from '../../world/index.js';

import { respondWorldNotReady } from './shared.js';

const isString = (value: unknown): value is string => typeof value === 'string';

export const handleListWorldTiles = (req: Request, res: Response): void => {
  if (!isWorldLoaded()) {
    respondWorldNotReady(res);
    return;
  }

  const regionKeyParam = req.query.regionKey;
  if (regionKeyParam !== undefined && !isString(regionKeyParam)) {
    res.status(400).json({
      error: 'INVALID_REGION_FILTER',
      message: 'regionKey filter must be a string when provided.'
    });
    return;
  }

  const state = getWorldState();
  let tiles = state.tiles;

  if (regionKeyParam) {
    const region = state.lookups.regionByKey.get(regionKeyParam);
    if (!region) {
      res.status(404).json({
        error: 'REGION_NOT_FOUND',
        message: `Region "${regionKeyParam}" was not found.`
      });
      return;
    }
    tiles = state.lookups.tilesByRegionId.get(region.id) ?? [];
  }

  const payload = tiles.map((tile) => ({
    q: tile.q,
    r: tile.r,
    terrain: tile.terrain,
    navigable: tile.navigable,
    regionKey: state.lookups.regionById.get(tile.regionId)?.regionKey ?? 'unknown',
    label: tile.label
  }));

  res.json(payload);
};
