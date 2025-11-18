import type { Request, Response } from 'express';

import { getWorldMetadata, isWorldLoaded } from '../../world/index.js';

import { respondWorldNotReady } from './shared.js';

export const handleDefaultWorldMetadata = (_req: Request, res: Response): void => {
  if (!isWorldLoaded()) {
    respondWorldNotReady(res);
    return;
  }

  const metadata = getWorldMetadata();
  res.json({
    worldKey: metadata.worldKey,
    name: metadata.name,
    description: metadata.description,
    version: metadata.version.toString(),
    boundaryPolicy: metadata.boundaryPolicy
  });
};
