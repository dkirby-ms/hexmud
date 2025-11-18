import type { Response } from 'express';

export const respondWorldNotReady = (res: Response): void => {
  res.status(503).json({
    error: 'WORLD_NOT_READY',
    message: 'Default world data has not finished loading yet.'
  });
};
