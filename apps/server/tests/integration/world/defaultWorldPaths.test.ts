import { beforeAll, describe, expect, it } from 'vitest';

import { getHexTile, getRegionForTile } from '../../../src/world/index.js';
import { formatHexId } from '../../../src/world/hexId.js';
import type { TerrainType } from '../../../src/world/types.js';
import { loadTestWorld } from '../../helpers/world.js';

const axialNeighborOffsets: Array<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, -1],
  [-1, 1]
];

interface QaPathStep {
  q: number;
  r: number;
  expectedTerrain: TerrainType;
  expectedRegion: string;
}

interface QaTraversalPath {
  description: string;
  steps: QaPathStep[];
}

const qaTraversalPaths = {
  continentABorder: {
    description: 'Move from inland Continent A to the first ocean tile on its coast.',
    steps: [
      { q: -4, r: 0, expectedTerrain: 'land', expectedRegion: 'continent_a' },
      { q: -3, r: 0, expectedTerrain: 'land', expectedRegion: 'continent_a' },
      { q: -2, r: 0, expectedTerrain: 'coastal', expectedRegion: 'continent_a' },
      { q: -1, r: 0, expectedTerrain: 'ocean', expectedRegion: 'ocean_main' }
    ]
  },
  mistralIslesBridge: {
    description: 'Cross from the Continent A shoreline across the ocean to the Mistral Isles.',
    steps: [
      { q: -1, r: 0, expectedTerrain: 'ocean', expectedRegion: 'ocean_main' },
      { q: -1, r: 1, expectedTerrain: 'ocean', expectedRegion: 'ocean_main' },
      { q: 0, r: 1, expectedTerrain: 'ocean', expectedRegion: 'ocean_main' },
      { q: 1, r: 1, expectedTerrain: 'island', expectedRegion: 'island_chain_mistral' },
      { q: 1, r: 2, expectedTerrain: 'coastal', expectedRegion: 'island_chain_mistral' },
      { q: 2, r: 2, expectedTerrain: 'island', expectedRegion: 'island_chain_mistral' }
    ]
  },
  continentAToBViaIsles: {
    description: 'End-to-end QA path verifying a player can reach Continent B via islands.',
    steps: [
      { q: -4, r: 0, expectedTerrain: 'land', expectedRegion: 'continent_a' },
      { q: -3, r: 0, expectedTerrain: 'land', expectedRegion: 'continent_a' },
      { q: -2, r: 0, expectedTerrain: 'coastal', expectedRegion: 'continent_a' },
      { q: -1, r: 0, expectedTerrain: 'ocean', expectedRegion: 'ocean_main' },
      { q: -1, r: 1, expectedTerrain: 'ocean', expectedRegion: 'ocean_main' },
      { q: 0, r: 1, expectedTerrain: 'ocean', expectedRegion: 'ocean_main' },
      { q: 1, r: 1, expectedTerrain: 'island', expectedRegion: 'island_chain_mistral' },
      { q: 1, r: 2, expectedTerrain: 'coastal', expectedRegion: 'island_chain_mistral' },
      { q: 2, r: 2, expectedTerrain: 'island', expectedRegion: 'island_chain_mistral' },
      { q: 3, r: 1, expectedTerrain: 'land', expectedRegion: 'continent_b' },
      { q: 3, r: 0, expectedTerrain: 'land', expectedRegion: 'continent_b' }
    ]
  }
} as const satisfies Record<string, QaTraversalPath>;

type QaPathName = keyof typeof qaTraversalPaths;

const getPath = (name: QaPathName): QaTraversalPath => qaTraversalPaths[name];

export const getQaPathHexIds = (name: QaPathName): string[] =>
  getPath(name).steps.map((step) => formatHexId({ q: step.q, r: step.r }));

const expectAdjacent = (previous: QaPathStep, next: QaPathStep): void => {
  const dq = next.q - previous.q;
  const dr = next.r - previous.r;
  const isNeighbor = axialNeighborOffsets.some(([offsetQ, offsetR]) => offsetQ === dq && offsetR === dr);
  expect(
    isNeighbor,
    `expected ${formatHexId({ q: next.q, r: next.r })} to be adjacent to ${formatHexId({ q: previous.q, r: previous.r })}`
  ).toBe(true);
};

const verifyPathStep = (step: QaPathStep): void => {
  const tile = getHexTile(step.q, step.r);
  const hexId = formatHexId({ q: step.q, r: step.r });
  expect(tile, `expected tile ${hexId} to exist`).toBeDefined();
  expect(tile?.terrain, `expected tile ${hexId} terrain`).toBe(step.expectedTerrain);
  expect(tile?.navigable, `expected tile ${hexId} to be navigable`).toBe(true);
  const region = getRegionForTile(step.q, step.r);
  expect(region?.regionKey, `expected tile ${hexId} region`).toBe(step.expectedRegion);
};

const verifyQaPath = (name: QaPathName): void => {
  const path = getPath(name);
  path.steps.forEach((step, index) => {
    verifyPathStep(step);
    if (index > 0) {
      expectAdjacent(path.steps[index - 1]!, step);
    }
  });
};

describe('default world QA traversal paths', () => {
  beforeAll(async () => {
    await loadTestWorld();
  });

  (Object.keys(qaTraversalPaths) as QaPathName[]).forEach((name) => {
    it(`validates ${name} path: ${getPath(name).description}`, () => {
      verifyQaPath(name);
    });
  });
});
