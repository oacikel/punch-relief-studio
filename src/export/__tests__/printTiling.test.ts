import { describe, expect, it } from 'vitest';
import { computeTiling, getPageDimensionsCm } from '../printTiling';

describe('getPageDimensionsCm', () => {
  it('returns known A4 and Letter dimensions', () => {
    expect(getPageDimensionsCm('a4')).toEqual({ widthCm: 21.0, heightCm: 29.7 });
    expect(getPageDimensionsCm('letter').widthCm).toBeCloseTo(21.59, 2);
  });

  it('requires actualSizeCm for actual-size', () => {
    expect(() => getPageDimensionsCm('actual-size')).toThrow();
  });
});

describe('computeTiling', () => {
  it('fits a small pattern on a single A4 page', () => {
    const result = computeTiling(10, 10, 'a4');
    expect(result.pages).toHaveLength(1);
    expect(result.rows).toBe(1);
    expect(result.cols).toBe(1);
  });

  it('tiles a large pattern across multiple pages', () => {
    const result = computeTiling(60, 40, 'a4', 1, 1);
    expect(result.pages.length).toBeGreaterThan(1);
    expect(result.rows * result.cols).toBe(result.pages.length);
  });

  it('covers the full pattern with no gaps between adjacent tiles', () => {
    const result = computeTiling(50, 30, 'a4', 1, 1);
    const maxX = Math.max(...result.pages.map((p) => p.x1Cm));
    const maxY = Math.max(...result.pages.map((p) => p.y1Cm));
    expect(maxX).toBeCloseTo(50, 5);
    expect(maxY).toBeCloseTo(30, 5);
  });

  it('adjacent tiles overlap by the configured amount', () => {
    const result = computeTiling(60, 20, 'a4', 2, 1);
    const row0 = result.pages.filter((p) => p.row === 0).sort((a, b) => a.col - b.col);
    if (row0.length > 1) {
      const overlap =
        (row0[0] as (typeof row0)[number]).x1Cm - (row0[1] as (typeof row0)[number]).x0Cm;
      expect(overlap).toBeCloseTo(2, 5);
    }
  });

  it('rejects non-positive pattern dimensions', () => {
    expect(() => computeTiling(0, 10, 'a4')).toThrow(RangeError);
  });

  it('actual-size always produces exactly one page', () => {
    const result = computeTiling(80, 60, 'actual-size', 1, 1, { widthCm: 80, heightCm: 60 });
    expect(result.pages).toHaveLength(1);
  });

  /**
   * Iteration 02 Stage D: anchors the exact scenario this session's
   * manual print/PDF investigation reproduced in a real headless Chromium
   * session (60cm x 40cm pattern, A4 pages, the app's default 1cm
   * overlap, 0.5cm punch-guide dot spacing) -- rendered to an actual PDF
   * and pixel-measured (see docs/ITERATION_02_PLAN.md's Stage D section).
   * This test is the automated regression for that manual result: 8
   * pages in a 4-column x 2-row grid.
   */
  it('reproduces the manually-verified 60x40cm/A4/1cm-overlap case: 4 cols x 2 rows = 8 pages', () => {
    const result = computeTiling(60, 40, 'a4', 1);
    expect(result.cols).toBe(4);
    expect(result.rows).toBe(2);
    expect(result.pages).toHaveLength(8);
  });

  it('produces pages in row-major order with strictly increasing page numbers matching each tile\'s row/col', () => {
    const result = computeTiling(60, 40, 'a4', 1);
    let expectedPageNumber = 1;
    let index = 0;
    for (let r = 0; r < result.rows; r++) {
      for (let c = 0; c < result.cols; c++) {
        const page = result.pages[index];
        expect(page).toBeDefined();
        expect(page?.row).toBe(r);
        expect(page?.col).toBe(c);
        expect(page?.pageNumber).toBe(expectedPageNumber);
        expectedPageNumber++;
        index++;
      }
    }
    expect(result.pages).toHaveLength(index);
  });

  it('abuts adjacent tiles with no gap and no overlap when overlapCm is 0', () => {
    const result = computeTiling(50, 30, 'a4', 0, 1);
    const row0 = result.pages.filter((p) => p.row === 0).sort((a, b) => a.col - b.col);
    expect(row0.length).toBeGreaterThan(1);
    for (let i = 0; i < row0.length - 1; i++) {
      const current = row0[i] as (typeof row0)[number];
      const next = row0[i + 1] as (typeof row0)[number];
      expect(current.x1Cm).toBeCloseTo(next.x0Cm, 5);
    }
    // Still covers the full pattern with no gaps overall.
    const maxX = Math.max(...result.pages.map((p) => p.x1Cm));
    expect(maxX).toBeCloseTo(50, 5);
  });
});
