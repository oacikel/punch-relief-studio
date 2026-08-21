import { describe, expect, it } from 'vitest';
import { computeLevelBounds, levelIndexForValue, quantize } from '../quantize';
import { normalizedDepth } from '../units';
import type { HeightLevel, Mask, ScalarField } from '../types';

function field(values: number[], width: number, height: number): ScalarField {
  return { width, height, data: Float32Array.from(values) };
}
function mask(values: number[], width: number, height: number): Mask {
  return { width, height, data: Uint8Array.from(values) };
}

describe('computeLevelBounds', () => {
  it('rejects level counts outside 2-12', () => {
    const f = field([0, 1], 2, 1);
    const m = mask([1, 1], 2, 1);
    expect(() => computeLevelBounds(1, 'equal-interval', f, m)).toThrow(RangeError);
    expect(() => computeLevelBounds(13, 'equal-interval', f, m)).toThrow(RangeError);
  });

  it('accepts the widened bounds (2 and 12 levels)', () => {
    const f = field([0, 1], 2, 1);
    const m = mask([1, 1], 2, 1);
    expect(computeLevelBounds(2, 'equal-interval', f, m)).toHaveLength(2);
    expect(computeLevelBounds(12, 'equal-interval', f, m)).toHaveLength(12);
  });

  it('equal-interval produces evenly spaced, monotonic bounds covering [0,1]', () => {
    const f = field([0, 1], 2, 1);
    const m = mask([1, 1], 2, 1);
    const bounds = computeLevelBounds(4, 'equal-interval', f, m);
    expect(bounds).toHaveLength(4);
    expect((bounds[0] as HeightLevel).lowerBound).toBeCloseTo(0);
    expect((bounds[3] as HeightLevel).upperBound).toBeCloseTo(1);
    for (let i = 1; i < bounds.length; i++) {
      expect((bounds[i] as HeightLevel).lowerBound).toBeGreaterThan(
        (bounds[i - 1] as HeightLevel).lowerBound,
      );
    }
  });

  it('quantile mode is deterministic across repeated calls on the same input', () => {
    const values = [0.1, 0.9, 0.2, 0.8, 0.3, 0.7, 0.4, 0.6, 0.5];
    const f = field(values, values.length, 1);
    const m = mask(Array(values.length).fill(1), values.length, 1);
    const a = computeLevelBounds(3, 'quantile', f, m);
    const b = computeLevelBounds(3, 'quantile', f, m);
    expect(a).toEqual(b);
  });

  it('quantile mode falls back gracefully for degenerate (all-equal) input', () => {
    const f = field([0.5, 0.5, 0.5, 0.5], 4, 1);
    const m = mask([1, 1, 1, 1], 4, 1);
    const bounds = computeLevelBounds(3, 'quantile', f, m);
    expect(bounds).toHaveLength(3);
    for (let i = 1; i < bounds.length; i++) {
      expect((bounds[i] as HeightLevel).lowerBound).toBeGreaterThan(
        (bounds[i - 1] as HeightLevel).lowerBound,
      );
    }
  });

  it('quantile bounds are contiguous with no gap between bands (regression test)', () => {
    // A value distribution likely to produce colliding percentile lookups.
    const values = [0.1, 0.1, 0.1, 0.9, 0.9, 0.9];
    const f = field(values, values.length, 1);
    const m = mask(Array(values.length).fill(1), values.length, 1);
    const bounds = computeLevelBounds(4, 'quantile', f, m);
    for (let i = 1; i < bounds.length; i++) {
      // The previous band's upper bound must exactly meet the next band's
      // lower bound -- any gap would cause levelIndexForValue to silently
      // fall through to the top level for values inside it.
      expect((bounds[i - 1] as HeightLevel).upperBound).toBeCloseTo(
        (bounds[i] as HeightLevel).lowerBound,
        9,
      );
    }
  });
});

describe('levelIndexForValue / boundary behavior', () => {
  const bounds = computeLevelBounds(4, 'equal-interval', field([0, 1], 2, 1), mask([1, 1], 2, 1));

  it('assigns the lowest level to 0', () => {
    expect(levelIndexForValue(normalizedDepth(0), bounds)).toBe(0);
  });

  it('assigns the highest level to 1 (inclusive upper bound on the last band)', () => {
    expect(levelIndexForValue(normalizedDepth(1), bounds)).toBe(3);
  });

  it('assigns values exactly on an interior boundary to the upper band', () => {
    expect(levelIndexForValue(normalizedDepth(0.25), bounds)).toBe(1);
  });

  it('is stable just below a boundary', () => {
    expect(levelIndexForValue(normalizedDepth(0.249), bounds)).toBe(0);
  });
});

describe('quantize', () => {
  it('assigns -1 to background pixels and a valid level to foreground', () => {
    const f = field([0, 0.5, 1, 0.9], 4, 1);
    const m = mask([1, 0, 1, 1], 4, 1);
    const bounds = computeLevelBounds(4, 'equal-interval', f, m);
    const result = quantize(f, m, bounds);
    expect(result.heightIndex[1]).toBe(-1);
    expect(result.heightIndex[0]).toBe(0);
    expect(result.heightIndex[2]).toBe(3);
  });
});
