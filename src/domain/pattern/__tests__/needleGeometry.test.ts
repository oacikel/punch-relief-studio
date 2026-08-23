import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NEEDLE_GEOMETRY,
  MIN_WIDTH_MULTIPLIER_SHORT,
  MIN_WIDTH_MULTIPLIER_TALL,
  isNeedleGeometrySet,
  loopHeightMmForLevel,
  minWidthMmForLevel,
  minWidthPxForLevel,
} from '../needleGeometry';

describe('isNeedleGeometrySet', () => {
  it('is false for the default (all-zero) geometry', () => {
    expect(isNeedleGeometrySet(DEFAULT_NEEDLE_GEOMETRY)).toBe(false);
  });

  it('is false when only one of the two fields is positive', () => {
    expect(isNeedleGeometrySet({ diameterMm: 2, throwMm: 0 })).toBe(false);
    expect(isNeedleGeometrySet({ diameterMm: 0, throwMm: 40 })).toBe(false);
  });

  it('is true once both fields are positive', () => {
    expect(isNeedleGeometrySet({ diameterMm: 2, throwMm: 40 })).toBe(true);
  });
});

describe('loopHeightMmForLevel', () => {
  const geometry = { diameterMm: 2, throwMm: 40 }; // max usable loop = 20mm

  it('the shortest level (0) is the needle diameter', () => {
    expect(loopHeightMmForLevel(0, 4, geometry)).toBeCloseTo(2);
  });

  it('the tallest level is the practical max throw (throwMm * 0.5)', () => {
    expect(loopHeightMmForLevel(3, 4, geometry)).toBeCloseTo(20);
  });

  it('interpolates linearly in between', () => {
    // 4 levels, index 1 of 0..3 => t = 1/3
    const expected = 2 + (20 - 2) * (1 / 3);
    expect(loopHeightMmForLevel(1, 4, geometry)).toBeCloseTo(expected);
  });

  it('returns the max height for a degenerate single-level count', () => {
    expect(loopHeightMmForLevel(0, 1, geometry)).toBeCloseTo(20);
  });
});

describe('minWidthMmForLevel', () => {
  const geometry = { diameterMm: 2, throwMm: 40 };

  it('uses the tall multiplier at the tallest level', () => {
    const width = minWidthMmForLevel(3, 4, geometry);
    expect(width).toBeCloseTo(MIN_WIDTH_MULTIPLIER_TALL * geometry.diameterMm);
  });

  it('uses the short multiplier at the shortest level', () => {
    const width = minWidthMmForLevel(0, 4, geometry);
    expect(width).toBeCloseTo(MIN_WIDTH_MULTIPLIER_SHORT * geometry.diameterMm);
  });

  it('is monotonically non-increasing as level (pile height) rises', () => {
    const widths = [0, 1, 2, 3].map((i) => minWidthMmForLevel(i, 4, geometry));
    for (let i = 1; i < widths.length; i++) {
      expect(widths[i]).toBeLessThanOrEqual(widths[i - 1] as number);
    }
  });

  it('falls back to the most conservative (short) multiplier when throw is too small relative to diameter', () => {
    // throwMm * 0.5 (=1) < diameterMm (=2) -- degenerate range.
    const degenerate = { diameterMm: 2, throwMm: 2 };
    const width = minWidthMmForLevel(1, 4, degenerate);
    expect(width).toBeCloseTo(MIN_WIDTH_MULTIPLIER_SHORT * degenerate.diameterMm);
  });

  it('reaches the tall multiplier once the loop-height ratio hits the cap, not just at the last level', () => {
    // diameterMm=2, throwMm=40 => max loop height 20mm, ratio 10 at the top
    // level -- well past LOOP_HEIGHT_RATIO_CAP (4). A generous needle like
    // this should reach the lenient multiplier across *most* of its
    // levels, not just asymptotically at the very last one.
    const geometry = { diameterMm: 2, throwMm: 40 };
    const widthLevel2of4 = minWidthMmForLevel(2, 4, geometry);
    expect(widthLevel2of4).toBeCloseTo(MIN_WIDTH_MULTIPLIER_TALL * geometry.diameterMm);
  });

  it('throwMm now actually changes the result -- the bug this replaced a level-index-only formula for', () => {
    // Same diameter and level, only throwMm differs. A short-throw needle
    // should demand a wider floor than a long-throw one at the same level,
    // since it can't reach as generous a loop-height ratio there. (Before
    // this fix, both t's were derived from the same level-index fraction
    // and throwMm's magnitude cancelled out entirely -- see
    // docs/DECISIONS.md.)
    const shortThrow = minWidthMmForLevel(1, 4, { diameterMm: 2, throwMm: 6 });
    const longThrow = minWidthMmForLevel(1, 4, { diameterMm: 2, throwMm: 40 });
    expect(shortThrow).toBeGreaterThan(longThrow);
  });

  it('matches a hand-computed trace for a real needle spec (2.2mm diameter, 40mm throw, 5 levels)', () => {
    // Locked in against the current MIN_WIDTH_MULTIPLIER_SHORT (1.4) /
    // LOOP_HEIGHT_RATIO_CAP (2.5) -- both were lowered from their initial
    // values (2.5 / 4, then 1.75 / 2.5) after real-needle testing showed
    // this exact spec should allow noticeably more detail than the
    // earlier constants gave it. Update this trace deliberately if those
    // constants move again.
    const geometry = { diameterMm: 2.2, throwMm: 40 };
    expect(minWidthMmForLevel(0, 5, geometry)).toBeCloseTo(3.08); // ratio 1 -> SHORT
    expect(minWidthMmForLevel(1, 5, geometry)).toBeCloseTo(2.2); // ratio ~3.02, capped -> TALL
    expect(minWidthMmForLevel(2, 5, geometry)).toBeCloseTo(2.2); // ratio ~5.05, capped -> TALL
    expect(minWidthMmForLevel(3, 5, geometry)).toBeCloseTo(2.2); // ratio ~7.07, capped -> TALL
    expect(minWidthMmForLevel(4, 5, geometry)).toBeCloseTo(2.2); // ratio ~9.09, capped -> TALL
  });
});

describe('minWidthPxForLevel', () => {
  const geometry = { diameterMm: 2, throwMm: 40 };

  it('returns 0 when the geometry is unset', () => {
    expect(minWidthPxForLevel(0, 4, DEFAULT_NEEDLE_GEOMETRY, 20, 20, 256, 256)).toBe(0);
  });

  it('returns 0 for non-positive physical dimensions', () => {
    expect(minWidthPxForLevel(0, 4, geometry, 0, 20, 256, 256)).toBe(0);
    expect(minWidthPxForLevel(0, 4, geometry, 20, -1, 256, 256)).toBe(0);
  });

  it('is a linear width (px), scaling proportionally with physical size at fixed raster resolution', () => {
    const smallPattern = minWidthPxForLevel(0, 4, geometry, 40, 40, 256, 256);
    const largePattern = minWidthPxForLevel(0, 4, geometry, 20, 20, 256, 256);
    // Halving the physical size doubles px-per-cm, so the linear px width
    // roughly doubles too.
    expect(largePattern / smallPattern).toBeGreaterThan(1.8);
  });

  it('is deterministic for the same inputs', () => {
    expect(minWidthPxForLevel(1, 4, geometry, 20, 20, 256, 256)).toBe(
      minWidthPxForLevel(1, 4, geometry, 20, 20, 256, 256),
    );
  });
});
