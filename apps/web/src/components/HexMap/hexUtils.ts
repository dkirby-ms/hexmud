import type { PresenceCell } from './usePresenceSnapshot.js';

export interface HexCoordinates {
  readonly q: number;
  readonly r: number;
}

export interface CanvasCellLayout {
  readonly centerX: number;
  readonly centerY: number;
  readonly path: Path2D;
}

export interface CanvasLayout {
  readonly width: number;
  readonly height: number;
  readonly cells: Map<string, CanvasCellLayout>;
}

export interface CanvasLayoutOptions {
  readonly hexSize?: number;
  readonly margin?: number;
  readonly defaultWidth?: number;
  readonly defaultHeight?: number;
}

export const DEFAULT_HEX_SIZE = 36;
export const DEFAULT_MARGIN = 32;
export const DEFAULT_CANVAS_WIDTH = 560;
export const DEFAULT_CANVAS_HEIGHT = 420;

export const parseHexCoordinates = (hexId: string): HexCoordinates | null => {
  const segments = hexId.split(':');
  if (segments.length < 3) {
    return null;
  }

  const q = Number.parseInt(segments[segments.length - 2] ?? '', 10);
  const r = Number.parseInt(segments[segments.length - 1] ?? '', 10);

  if (!Number.isFinite(q) || !Number.isFinite(r)) {
    return null;
  }

  return { q, r };
};

export const axialToPixel = (
  q: number,
  r: number,
  hexSize: number = DEFAULT_HEX_SIZE
): { x: number; y: number } => {
  const x = hexSize * Math.sqrt(3) * (q + r / 2);
  const y = hexSize * (3 / 2) * r;
  return { x, y };
};

export const createHexPath = (
  centerX: number,
  centerY: number,
  hexSize: number = DEFAULT_HEX_SIZE
): Path2D => {
  const path = new Path2D();
  for (let index = 0; index < 6; index += 1) {
    const angle = ((Math.PI / 180) * 60 * index) - Math.PI / 6;
    const x = centerX + hexSize * Math.cos(angle);
    const y = centerY + hexSize * Math.sin(angle);
    if (index === 0) {
      path.moveTo(x, y);
    } else {
      path.lineTo(x, y);
    }
  }
  path.closePath();
  return path;
};

export const computeCanvasLayout = (
  cells: Map<string, PresenceCell>,
  options: CanvasLayoutOptions = {}
): CanvasLayout => {
  const hexSize = options.hexSize ?? DEFAULT_HEX_SIZE;
  const margin = options.margin ?? DEFAULT_MARGIN;
  const defaultWidth = options.defaultWidth ?? DEFAULT_CANVAS_WIDTH;
  const defaultHeight = options.defaultHeight ?? DEFAULT_CANVAS_HEIGHT;

  if (cells.size === 0) {
    return {
      width: defaultWidth,
      height: defaultHeight,
      cells: new Map()
    };
  }

  const hexWidth = Math.sqrt(3) * hexSize;
  const working: { hexId: string; x: number; y: number }[] = [];
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const [hexId] of cells) {
    const coords = parseHexCoordinates(hexId);
    if (!coords) {
      continue;
    }
    const { x, y } = axialToPixel(coords.q, coords.r, hexSize);
    working.push({ hexId, x, y });
    minX = Math.min(minX, x - hexWidth / 2);
    maxX = Math.max(maxX, x + hexWidth / 2);
    minY = Math.min(minY, y - hexSize);
    maxY = Math.max(maxY, y + hexSize);
  }

  if (!working.length) {
    return {
      width: defaultWidth,
      height: defaultHeight,
      cells: new Map()
    };
  }

  const width = Math.max(defaultWidth, Math.ceil(maxX - minX + margin * 2));
  const height = Math.max(defaultHeight, Math.ceil(maxY - minY + margin * 2));
  const offsetX = margin - minX;
  const offsetY = margin - minY;

  const layoutCells = new Map<string, CanvasCellLayout>();
  for (const entry of working) {
    const centerX = entry.x + offsetX;
    const centerY = entry.y + offsetY;
    layoutCells.set(entry.hexId, {
      centerX,
      centerY,
      path: createHexPath(centerX, centerY, hexSize)
    });
  }

  return {
    width,
    height,
    cells: layoutCells
  };
};
