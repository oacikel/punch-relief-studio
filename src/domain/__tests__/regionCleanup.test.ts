import { describe, expect, it } from 'vitest';
import {
  applyNeedleWidthOpening,
  chebyshevDistanceTransform,
  cleanupTinyRegions,
  findConnectedComponents,
  findSmallRegions,
} from '../regionCleanup';

describe('findConnectedComponents', () => {
  it('finds two separate same-value blobs as distinct components', () => {
    // 4x1 grid: [0, 0, -1, 0]  -> two components of value 0
    const index = Int16Array.from([0, 0, -1, 0]);
    const components = findConnectedComponents(index, 4, 1);
    const nonBackground = components.filter((c) => c.levelValue !== -1);
    expect(nonBackground).toHaveLength(2);
  });

  it('treats a single connected region as one component', () => {
    const index = Int16Array.from([1, 1, 1, 1]);
    const components = findConnectedComponents(index, 4, 1);
    expect(components).toHaveLength(1);
    expect(components[0]?.pixels).toHaveLength(4);
  });

  it('never includes background (-1) pixels in a component', () => {
    const index = Int16Array.from([-1, -1, -1]);
    const components = findConnectedComponents(index, 3, 1);
    expect(components).toHaveLength(0);
  });
});

describe('cleanupTinyRegions', () => {
  it('reassigns a tiny region to its largest neighbor', () => {
    // 5x1: value 0 dominates except a single pixel of value 1 in the middle.
    const index = Int16Array.from([0, 0, 1, 0, 0]);
    const result = cleanupTinyRegions(index, 5, 1, 2);
    expect(Array.from(result)).toEqual([0, 0, 0, 0, 0]);
  });

  it('leaves regions at or above the minimum size untouched', () => {
    const index = Int16Array.from([0, 0, 1, 1, 0, 0]);
    const result = cleanupTinyRegions(index, 6, 1, 2);
    expect(Array.from(result)).toEqual([0, 0, 1, 1, 0, 0]);
  });

  it('is a no-op when minSizePx <= 1', () => {
    const index = Int16Array.from([0, 1, 0]);
    const result = cleanupTinyRegions(index, 3, 1, 1);
    expect(Array.from(result)).toEqual([0, 1, 0]);
  });
});

describe('chebyshevDistanceTransform', () => {
  it('gives every falsy cell distance 0', () => {
    const mask = Uint8Array.from([0, 1, 0, 1]);
    const dist = chebyshevDistanceTransform(mask, 4, 1);
    expect(dist[0]).toBe(0);
    expect(dist[2]).toBe(0);
  });

  it('treats the canvas edge as a boundary when treatOutOfBoundsAsZero is true (the default)', () => {
    // 3x3, all truthy -- every cell touches the edge within 1 step except
    // the true center, which is 2 steps from every edge.
    const mask = Uint8Array.from([1, 1, 1, 1, 1, 1, 1, 1, 1]);
    const dist = chebyshevDistanceTransform(mask, 3, 3, true);
    expect(dist[0]).toBe(1); // corner
    expect(dist[4]).toBe(2); // center
  });

  it('does not treat the canvas edge as a boundary when treatOutOfBoundsAsZero is false', () => {
    const mask = Uint8Array.from([1, 1, 1, 1, 1, 1, 1, 1, 1]);
    const dist = chebyshevDistanceTransform(mask, 3, 3, false);
    // No falsy cell anywhere -- distance is the large sentinel, not a small
    // edge-derived number.
    expect(dist[0]).toBeGreaterThan(1000);
    expect(dist[4]).toBeGreaterThan(1000);
  });
});

describe('applyNeedleWidthOpening', () => {
  it('is a no-op when every level has a non-positive radius', () => {
    const index = Int16Array.from([0, 0, 1, 0, 0]);
    const result = applyNeedleWidthOpening(index, 5, 1, () => 0);
    expect(Array.from(result)).toEqual([0, 0, 1, 0, 0]);
  });

  it('absorbs a fully isolated 1px-wide sliver into its only real neighbor', () => {
    const index = Int16Array.from([5, 5, 5, 0, 5, 5, 5]);
    const result = applyNeedleWidthOpening(index, 7, 1, (level) => (level === 0 ? 2 : 0));
    expect(Array.from(result)).toEqual([5, 5, 5, 5, 5, 5, 5]);
  });

  it('leaves background (-1) untouched and never grows a region into it', () => {
    const index = Int16Array.from([-1, 0, -1]);
    const result = applyNeedleWidthOpening(index, 3, 1, () => 2);
    expect(Array.from(result)).toEqual([-1, 0, -1]);
  });

  // The regression case this function exists for: a region can have
  // plenty of total *area* while still having a thin neck/spike an
  // area-only check (the old cleanupTinyRegionsByLevel approach) would
  // never catch. 9x5 grid: a solid 5x5 block (level 0, cols 0-4) with a
  // 1px-wide, 3-long spike (level 0, row 2, cols 5-7) sticking out,
  // flanked top/bottom by level 1 for the spike's whole length.
  it('absorbs a thin spike into its flanking region even though the attached blob is large', () => {
    const width = 9;
    const height = 5;
    const index = new Int16Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const isBlock = x <= 4;
        const isSpike = y === 2 && x >= 5 && x <= 7;
        index[i] = isBlock || isSpike ? 0 : 1;
      }
    }
    // Radius 1 for level 0 -- needs roughly 3px of width to survive.
    const result = applyNeedleWidthOpening(index, width, height, (level) => (level === 0 ? 1 : 0));
    const at = (x: number, y: number): number => result[y * width + x] as number;

    // The block's core and its edge nearest the spike stay level 0 --
    // plenty wide, not affected.
    expect(at(2, 2)).toBe(0);
    expect(at(4, 2)).toBe(0);
    // The spike's middle and tip cells are only 1px wide with level 1
    // immediately above and below along their entire length -- both
    // unambiguously closer to level 1 than back through the (also-thin)
    // spike to the block -- so they get absorbed into level 1. This is
    // exactly the case a pure area check would miss, since the block+spike
    // component's total area is large.
    expect(at(6, 2)).toBe(1);
    expect(at(7, 2)).toBe(1);
  });

  // The "bigger diameter looks more detailed" regression: a radius large
  // enough that NOTHING survives erosion anywhere leaves the primary BFS
  // with no seed to grow from -- without the fallback pass, the result
  // would come back completely unchanged, i.e. a stricter setting would
  // paradoxically simplify *less* than a milder one that still leaves some
  // survivors. Two small adjacent components, radius far larger than the
  // whole grid, so literally no pixel of either level can be "deep enough."
  it('still merges something when the radius is so large that no level has any erosion survivor anywhere', () => {
    const index = Int16Array.from([0, 0, 1, 1]);
    const result = applyNeedleWidthOpening(index, 4, 1, () => 1000);
    // Must not come back unchanged -- the two components collapse into one.
    expect(new Set(Array.from(result)).size).toBe(1);
    expect(Array.from(result)).not.toEqual([0, 0, 1, 1]);
  });

  it('a larger radius never produces a less-simplified result than a smaller one, across a wide sweep', () => {
    // Same "spike off a large block" shape as above, swept across radii
    // from small to absurdly large (including past the point where
    // erosion survivors vanish entirely). Track how many distinct level-0
    // pixels remain (the spike absorbed = fewer) -- this must never
    // *increase* as the radius grows.
    const width = 9;
    const height = 5;
    const index = new Int16Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const isBlock = x <= 4;
        const isSpike = y === 2 && x >= 5 && x <= 7;
        index[i] = isBlock || isSpike ? 0 : 1;
      }
    }
    const radii = [0, 1, 2, 3, 5, 10, 50, 1000];
    let previousLevel0Count = Infinity;
    for (const r of radii) {
      const result = applyNeedleWidthOpening(index, width, height, (level) =>
        level === 0 ? r : 0,
      );
      const level0Count = Array.from(result).filter((v) => v === 0).length;
      expect(level0Count).toBeLessThanOrEqual(previousLevel0Count);
      previousLevel0Count = level0Count;
    }
  });
});

describe('findSmallRegions', () => {
  it('reports remaining below-threshold regions after cleanup', () => {
    const index = Int16Array.from([-1, 2, -1]); // isolated region, no reassignable neighbor
    const warnings = findSmallRegions(index, 3, 1, 5);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.sizePx).toBe(1);
  });
});
