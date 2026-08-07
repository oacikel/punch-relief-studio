import { describe, expect, it } from 'vitest';
import {
  NoForegroundPixelsError,
  applyIntensity,
  buildForegroundMask,
  invertRelief,
  normalizeDepth,
  smoothRelief,
} from '../relief';
import type { ScalarField } from '../types';

function makeMask(data: number[], width: number, height: number) {
  return { width, height, data: Uint8Array.from(data) };
}

describe('buildForegroundMask', () => {
  it('marks finite, non-empty-value pixels as foreground', () => {
    const depth = Float32Array.from([1, -1, 2, NaN]);
    const mask = buildForegroundMask(depth, 2, 2, -1);
    expect(Array.from(mask.data)).toEqual([1, 0, 1, 0]);
  });
});

describe('normalizeDepth', () => {
  it('maps nearest (smallest raw depth) to 1 and farthest to 0', () => {
    const depth = Float32Array.from([2, 4, 6]);
    const mask = makeMask([1, 1, 1], 3, 1);
    const field = normalizeDepth(depth, mask);
    expect(field.data[0]).toBeCloseTo(1); // nearest
    expect(field.data[2]).toBeCloseTo(0); // farthest
    expect(field.data[1]).toBeCloseTo(0.5);
  });

  it('throws NoForegroundPixelsError when the mask is all-background', () => {
    const depth = Float32Array.from([1, 2, 3]);
    const mask = makeMask([0, 0, 0], 3, 1);
    expect(() => normalizeDepth(depth, mask)).toThrow(NoForegroundPixelsError);
  });

  it('background pixels are zeroed regardless of raw depth', () => {
    const depth = Float32Array.from([2, 4, 6]);
    const mask = makeMask([1, 0, 1], 3, 1);
    const field = normalizeDepth(depth, mask);
    expect(field.data[1]).toBe(0);
  });
});

describe('invertRelief', () => {
  it('is a no-op when invert=false', () => {
    const field: ScalarField = { width: 2, height: 1, data: Float32Array.from([0.2, 0.8]) };
    const result = invertRelief(field, false);
    expect(Array.from(result.data)).toEqual(Array.from(Float32Array.from([0.2, 0.8])));
  });

  it('flips values around 0.5 when invert=true', () => {
    const field: ScalarField = { width: 2, height: 1, data: Float32Array.from([0.2, 0.8]) };
    const result = invertRelief(field, true);
    expect(result.data[0]).toBeCloseTo(0.8);
    expect(result.data[1]).toBeCloseTo(0.2);
  });
});

describe('applyIntensity', () => {
  it('intensity=1 leaves foreground values unchanged', () => {
    const field: ScalarField = { width: 3, height: 1, data: Float32Array.from([0.1, 0.5, 0.9]) };
    const mask = makeMask([1, 1, 1], 3, 1);
    const result = applyIntensity(field, mask, 1);
    expect(Array.from(result.data).map((v) => Number(v.toFixed(5)))).toEqual([0.1, 0.5, 0.9]);
  });

  it('intensity=0 flattens all foreground values to the mean', () => {
    const field: ScalarField = { width: 3, height: 1, data: Float32Array.from([0, 0.5, 1]) };
    const mask = makeMask([1, 1, 1], 3, 1);
    const result = applyIntensity(field, mask, 0);
    expect(result.data[0]).toBeCloseTo(0.5);
    expect(result.data[1]).toBeCloseTo(0.5);
    expect(result.data[2]).toBeCloseTo(0.5);
  });
});

describe('smoothRelief', () => {
  it('strength=0 returns the field unchanged (same values)', () => {
    const field: ScalarField = {
      width: 3,
      height: 3,
      data: Float32Array.from(
        Array(9)
          .fill(0)
          .map((_, i) => i / 8),
      ),
    };
    const mask = makeMask(Array(9).fill(1), 3, 3);
    const result = smoothRelief(field, mask, 0, 0.5);
    expect(Array.from(result.data)).toEqual(Array.from(field.data));
  });

  it('reduces variance of a noisy field when smoothing is applied', () => {
    const values = [0, 1, 0, 1, 0, 1, 0, 1, 0];
    const field: ScalarField = { width: 3, height: 3, data: Float32Array.from(values) };
    const mask = makeMask(Array(9).fill(1), 3, 3);
    const result = smoothRelief(field, mask, 1, 0);
    const variance = (arr: Float32Array): number => {
      const mean = Array.from(arr).reduce((a, b) => a + b, 0) / arr.length;
      return Array.from(arr).reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
    };
    expect(variance(result.data)).toBeLessThan(variance(field.data));
  });
});
