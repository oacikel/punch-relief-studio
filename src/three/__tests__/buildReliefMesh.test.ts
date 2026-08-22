import { describe, expect, it } from 'vitest';
import { buildReliefGeometry } from '../buildReliefMesh';
import { createDefaultProfile } from '@/domain/calibration';
import { normalizedDepth } from '@/domain/units';
import type { HeightLevel, RegionMap } from '@/domain/types';

const LEVELS: HeightLevel[] = [
  { index: 0, lowerBound: normalizedDepth(0), upperBound: normalizedDepth(1) },
];
const PROFILE = createDefaultProfile();

/**
 * Background exclusion (docs/ITERATION_03_PLAN.md #9): a 4x4 pixel region
 * map with a 2x2 foreground block in the middle (rows 1-2, cols 1-2) and
 * background (-1) everywhere else. Exactly one grid cell -- the one whose
 * four corners are all foreground -- should survive as real triangles;
 * every other cell touches at least one background vertex and must be
 * dropped rather than built as a solid zero-height slab.
 */
function fourByFourWithForegroundCenter(): RegionMap {
  const width = 4;
  const height = 4;
  const heightIndex = new Int16Array(width * height).fill(-1);
  for (const [x, y] of [
    [1, 1],
    [2, 1],
    [1, 2],
    [2, 2],
  ]) {
    heightIndex[(y as number) * width + (x as number)] = 0;
  }
  return { width, height, heightIndex, colorIndex: heightIndex.slice() };
}

function allBackground(width: number, height: number): RegionMap {
  const heightIndex = new Int16Array(width * height).fill(-1);
  return { width, height, heightIndex, colorIndex: heightIndex.slice() };
}

/** Mirrors buildReliefGeometry's own row/col -> pixel mapping so the test
 * can independently verify every retained triangle's vertices really are
 * foreground pixels, without re-testing the implementation against itself
 * by construction. */
function pixelHeightIndexForVertex(
  regionMap: RegionMap,
  vertexIndex: number,
  gridWidth: number,
): number {
  const col = vertexIndex % gridWidth;
  const row = Math.floor(vertexIndex / gridWidth);
  const flippedRow = regionMap.height - 1 - row;
  return regionMap.heightIndex[flippedRow * regionMap.width + col] as number;
}

describe('buildReliefGeometry -- background exclusion', () => {
  it('drops every triangle touching a background vertex, keeping only the fully-foreground cell', () => {
    const regionMap = fourByFourWithForegroundCenter();
    const geometry = buildReliefGeometry(regionMap, {
      widthCm: 10,
      heightCm: 10,
      levels: LEVELS,
      profile: PROFILE,
    });

    const index = geometry.getIndex();
    expect(index).not.toBeNull();
    const gridWidth = regionMap.width; // PlaneGeometry(width-1, height-1) segments -> width vertices per row
    expect(index?.count).toBeGreaterThan(0);
    for (let i = 0; i < (index?.count ?? 0); i++) {
      const v = index?.getX(i) as number;
      expect(pixelHeightIndexForVertex(regionMap, v, gridWidth)).not.toBe(-1);
    }
    // Exactly one grid cell (2 triangles, 6 indices) has all four corners
    // foreground for this fixture.
    expect(index?.count).toBe(6);
  });

  it('produces an empty index for an all-background region map (no false floor slab)', () => {
    const regionMap = allBackground(3, 3);
    const geometry = buildReliefGeometry(regionMap, {
      widthCm: 10,
      heightCm: 10,
      levels: LEVELS,
      profile: PROFILE,
    });

    const index = geometry.getIndex();
    expect(index?.count ?? 0).toBe(0);
  });

  it('keeps the whole grid when every pixel is foreground (no regression on a fully-solid model)', () => {
    const width = 4;
    const height = 4;
    const heightIndex = new Int16Array(width * height).fill(0);
    const regionMap: RegionMap = { width, height, heightIndex, colorIndex: heightIndex.slice() };
    const geometry = buildReliefGeometry(regionMap, {
      widthCm: 10,
      heightCm: 10,
      levels: LEVELS,
      profile: PROFILE,
    });

    const index = geometry.getIndex();
    // (width-1) * (height-1) cells, 2 triangles (6 indices) each.
    expect(index?.count).toBe((width - 1) * (height - 1) * 6);
  });
});
