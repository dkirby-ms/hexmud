export type RegionType = 'continent' | 'ocean' | 'island_chain' | 'other';
export type TerrainType = 'land' | 'ocean' | 'coastal' | 'island' | 'blocked';
export type BoundaryPolicy = 'hard-edge';

export interface WorldDefinition {
  id: number;
  worldKey: string;
  name: string;
  description: string | null;
  version: number;
  boundaryPolicy: BoundaryPolicy;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorldRegion {
  id: number;
  worldId: number;
  regionKey: string;
  name: string;
  type: RegionType;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorldHexTile {
  id: number;
  worldId: number;
  regionId: number;
  q: number;
  r: number;
  terrain: TerrainType;
  navigable: boolean;
  label: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorldSpawnRegion {
  id: number;
  worldId: number;
  regionId: number;
  name: string;
  description: string | null;
  minDistanceFromEdge: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorldModuleConfig {
  worldKey: string;
  boundaryPolicy: BoundaryPolicy;
}

export interface HexCoordinate {
  q: number;
  r: number;
}

export interface WorldLookupTables {
  byCoordinate: Map<string, WorldHexTile>;
  byRegion: Map<string, WorldHexTile[]>;
  spawnRegions: WorldSpawnRegion[];
}

export const serializeCoordinate = ({ q, r }: HexCoordinate): string => `${q},${r}`;
