import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NEEDLE_GEOMETRY,
  estimatedPileHeightStepCm,
  isNeedleDiameterSet,
  minimumZoneWidthMm,
  minimumZoneWidthPx,
} from '../needleGeometry';

describe('needle diameter detail floor', () => {
  it('is disabled only when diameter is omitted', () => {
    expect(isNeedleDiameterSet(DEFAULT_NEEDLE_GEOMETRY)).toBe(false);
    expect(isNeedleDiameterSet({ diameterMm: 0, throwMm: 40 })).toBe(false);
    expect(isNeedleDiameterSet({ diameterMm: 2.2, throwMm: 0 })).toBe(true);
  });

  it('uses exactly one tip diameter regardless of needle length', () => {
    expect(minimumZoneWidthMm({ diameterMm: 2.2, throwMm: 0 })).toBe(2.2);
    expect(minimumZoneWidthMm({ diameterMm: 2.2, throwMm: 10 })).toBe(2.2);
    expect(minimumZoneWidthMm({ diameterMm: 2.2, throwMm: 40 })).toBe(2.2);
  });

  it('converts the physical diameter to pixels using project dimensions', () => {
    const geometry = { diameterMm: 2, throwMm: 0 };
    expect(minimumZoneWidthPx(geometry, 20, 20, 200, 200)).toBeCloseTo(2);
    expect(minimumZoneWidthPx(geometry, 10, 10, 200, 200)).toBeCloseTo(4);
  });

  it('returns zero pixels when diameter or project dimensions are invalid', () => {
    expect(minimumZoneWidthPx(DEFAULT_NEEDLE_GEOMETRY, 20, 20, 256, 256)).toBe(0);
    expect(minimumZoneWidthPx({ diameterMm: 2, throwMm: 0 }, 0, 20, 256, 256)).toBe(0);
  });
});

describe('optional needle length', () => {
  it('does not invent a pile-height step when length is omitted', () => {
    expect(estimatedPileHeightStepCm(4, { diameterMm: 2.2, throwMm: 0 })).toBeNull();
  });

  it('estimates a level step whose tallest level is half the maximum needle length', () => {
    const step = estimatedPileHeightStepCm(4, { diameterMm: 0, throwMm: 40 });
    expect(step).toBeCloseTo(0.5);
    expect((step as number) * 4).toBeCloseTo(2);
  });
});
