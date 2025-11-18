import type { Request, Response } from 'express';

import { isWorldLoaded, listWorldRegions } from '../../world/index.js';

import { respondWorldNotReady } from './shared.js';

export const handleListWorldRegions = (_req: Request, res: Response): void => {
  if (!isWorldLoaded()) {
    respondWorldNotReady(res);
    return;
  }

  const regions = listWorldRegions().map((region) => ({
    regionKey: region.regionKey,
    name: region.name,
    type: region.type,
    description: region.description
  }));

  res.json(regions);
};
