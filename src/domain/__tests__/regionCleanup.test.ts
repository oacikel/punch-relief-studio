import { describe, expect, it } from 'vitest';
import { cleanupTinyRegions, findConnectedComponents, findSmallRegions } from '../regionCleanup';

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

describe('findSmallRegions', () => {
  it('reports remaining below-threshold regions after cleanup', () => {
    const index = Int16Array.from([-1, 2, -1]); // isolated region, no reassignable neighbor
    const warnings = findSmallRegions(index, 3, 1, 5);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.sizePx).toBe(1);
  });
});
