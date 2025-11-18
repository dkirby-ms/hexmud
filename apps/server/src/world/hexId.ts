import type { HexCoordinate } from './types.js';

const HEX_ID_PATTERN = /^hex:(-?\d+):(-?\d+)$/;

export type ParsedHexId = HexCoordinate;

export const parseHexId = (hexId: string): ParsedHexId | null => {
  if (typeof hexId !== 'string') {
    return null;
  }

  const match = HEX_ID_PATTERN.exec(hexId);
  if (!match) {
    return null;
  }

  const [, qRaw = '', rRaw = ''] = match;
  const q = Number.parseInt(qRaw, 10);
  const r = Number.parseInt(rRaw, 10);

  if (Number.isNaN(q) || Number.isNaN(r)) {
    return null;
  }

  return { q, r };
};

export const formatHexId = ({ q, r }: HexCoordinate): string => `hex:${q}:${r}`;

export const isHexId = (value: string): boolean => HEX_ID_PATTERN.test(value);
