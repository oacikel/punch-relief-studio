import { describe, expect, it } from 'vitest';
import { cm, cmToPx } from '@/domain/units';
import {
  DEFAULT_PUNCH_GUIDE_SPACING_CM,
  MAX_PUNCH_GUIDE_SPACING_CM,
  MIN_PUNCH_GUIDE_SPACING_CM,
  clampPunchGuideSpacingCm,
  computePunchGuideDots,
} from '../punchGuide';

describe('computePunchGuideDots', () => {
  it('produces a grid whose row/column count matches width/height divided by spacing', () => {
    // 10cm x 10cm canvas, 2cm spacing -> 5 columns, 5 rows (dots start at
    // half-spacing: 1, 3, 5, 7, 9 -- all < 10).
    const dots = computePunchGuideDots(10, 10, 2, 20);
    expect(dots).toHaveLength(25);
  });

  it('starts each row/column half a spacing in from the top-left edge', () => {
    const pxPerCm = 20;
    const dots = computePunchGuideDots(10, 10, 2, pxPerCm);
    const first = dots[0];
    expect(first).toBeDefined();
    // half of 2cm = 1cm, converted via the named cmToPx conversion --
    // asserts the module actually routes through units.ts, not a bare
    // multiplication that happens to produce the same number.
    expect(first?.x).toBe(cmToPx(cm(1), pxPerCm));
    expect(first?.y).toBe(cmToPx(cm(1), pxPerCm));
  });

  it('converts every dot position via the named cmToPx conversion (no drift from stepping in px space)', () => {
    const pxPerCm = 37; // deliberately not a round number, to catch rounding-order bugs
    const widthCm = 12;
    const heightCm = 8;
    const spacingCm = 1.5;
    const dots = computePunchGuideDots(widthCm, heightCm, spacingCm, pxPerCm);

    const half = spacingCm / 2;
    const expectedCols: number[] = [];
    for (let xCm = half; xCm < widthCm; xCm += spacingCm) expectedCols.push(xCm);
    const expectedRows: number[] = [];
    for (let yCm = half; yCm < heightCm; yCm += spacingCm) expectedRows.push(yCm);

    expect(dots).toHaveLength(expectedCols.length * expectedRows.length);

    // Every dot's px position must equal the direct per-index cm->px
    // conversion, not an accumulated running sum -- rounds each
    // coordinate independently the same way cmToPx does.
    for (const dot of dots) {
      const matchesSomeExpectedX = expectedCols.some((xCm) => cmToPx(cm(xCm), pxPerCm) === dot.x);
      const matchesSomeExpectedY = expectedRows.some((yCm) => cmToPx(cm(yCm), pxPerCm) === dot.y);
      expect(matchesSomeExpectedX).toBe(true);
      expect(matchesSomeExpectedY).toBe(true);
    }
  });

  it('returns an empty grid for a zero or negative canvas size', () => {
    expect(computePunchGuideDots(0, 10, 1, 20)).toEqual([]);
    expect(computePunchGuideDots(10, 0, 1, 20)).toEqual([]);
    expect(computePunchGuideDots(-5, 10, 1, 20)).toEqual([]);
  });

  it('throws for non-positive spacing rather than looping forever or dividing by zero', () => {
    expect(() => computePunchGuideDots(10, 10, 0, 20)).toThrow('spacingCm must be positive');
    expect(() => computePunchGuideDots(10, 10, -1, 20)).toThrow('spacingCm must be positive');
  });

  it('produces no dots when spacing exceeds both canvas dimensions', () => {
    expect(computePunchGuideDots(1, 1, 5, 20)).toEqual([]);
  });

  it('scales dot count inversely with spacing (denser grid for smaller spacing)', () => {
    const wide = computePunchGuideDots(20, 20, 1, 20);
    const sparse = computePunchGuideDots(20, 20, 4, 20);
    expect(wide.length).toBeGreaterThan(sparse.length);
  });
});

describe('clampPunchGuideSpacingCm', () => {
  it('passes values already within range through unchanged', () => {
    expect(clampPunchGuideSpacingCm(1.5)).toBe(1.5);
  });

  it('clamps values below the minimum up to the minimum', () => {
    expect(clampPunchGuideSpacingCm(0)).toBe(MIN_PUNCH_GUIDE_SPACING_CM);
    expect(clampPunchGuideSpacingCm(-3)).toBe(MIN_PUNCH_GUIDE_SPACING_CM);
  });

  it('clamps values above the maximum down to the maximum', () => {
    expect(clampPunchGuideSpacingCm(100)).toBe(MAX_PUNCH_GUIDE_SPACING_CM);
  });

  it('falls back to the default for non-finite input instead of propagating NaN', () => {
    expect(clampPunchGuideSpacingCm(NaN)).toBe(DEFAULT_PUNCH_GUIDE_SPACING_CM);
    expect(clampPunchGuideSpacingCm(Infinity)).toBe(DEFAULT_PUNCH_GUIDE_SPACING_CM);
    expect(clampPunchGuideSpacingCm(-Infinity)).toBe(DEFAULT_PUNCH_GUIDE_SPACING_CM);
  });
});
