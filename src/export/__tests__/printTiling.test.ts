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
      const overlap = row0[0].x1Cm - row0[1].x0Cm;
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
});
