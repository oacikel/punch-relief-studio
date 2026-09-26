import { describe, expect, it } from 'vitest';
import { findConnectedComponents } from '@/domain/regionCleanup';
import { simplifyImage } from '../simplifyImage';

const baseSettings = {
  paletteSize: 3,
  detail: 'balanced' as const,
  smoothingStrength: 0.5,
  edgePreservation: 0.7,
  seed: 123,
  needleGeometry: { diameterMm: 0, throwMm: 0 },
  patternDimensions: { widthCm: 20, heightCm: 20 },
  preserveSmallDetails: false,
};

function image(width: number, height: number, colorAt: (x: number, y: number) => number[]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r = 0, g = 0, b = 0, a = 255] = colorAt(x, y);
      data.set([r, g, b, a], (y * width + x) * 4);
    }
  }
  return data;
}

describe('simplifyImage', () => {
  it('is deterministic and produces a single pile height', () => {
    const rgba = image(12, 8, (x) => (x < 6 ? [210, 50, 40, 255] : [30, 90, 180, 255]));
    const first = simplifyImage(rgba, 12, 8, baseSettings);
    const second = simplifyImage(rgba, 12, 8, baseSettings);
    expect(Array.from(first.colorIndex)).toEqual(Array.from(second.colorIndex));
    expect(first.palette).toEqual(second.palette);
    expect(new Set(first.heightIndex)).toEqual(new Set([0]));
  });

  it('merges a tiny contrasting speck into a neighboring zone', () => {
    const rgba = image(40, 40, (x, y) =>
      x === 20 && y === 20 ? [20, 220, 40, 255] : [180, 55, 45, 255],
    );
    const result = simplifyImage(rgba, 40, 40, baseSettings);
    expect(findConnectedComponents(result.colorIndex, 40, 40)).toHaveLength(1);
  });

  it('enlarges tiny high-contrast marks so they survive region cleanup', () => {
    const rgba = image(80, 80, (x, y) =>
      (x === 20 && y === 20) || (x === 55 && y === 42) ? [245, 245, 240, 255] : [10, 18, 24, 255],
    );
    const withoutProtection = simplifyImage(rgba, 80, 80, {
      ...baseSettings,
      detail: 'fine',
      smoothingStrength: 0,
    });
    const withProtection = simplifyImage(rgba, 80, 80, {
      ...baseSettings,
      detail: 'fine',
      smoothingStrength: 0,
      preserveSmallDetails: true,
    });

    expect(findConnectedComponents(withoutProtection.colorIndex, 80, 80)).toHaveLength(1);
    expect(findConnectedComponents(withProtection.colorIndex, 80, 80)).toHaveLength(3);
  });

  it('does not rescue low-contrast texture', () => {
    const rgba = image(80, 80, (x, y) =>
      x === 40 && y === 40 ? [45, 48, 52, 255] : [38, 41, 45, 255],
    );
    const result = simplifyImage(rgba, 80, 80, {
      ...baseSettings,
      paletteSize: 2,
      detail: 'fine',
      smoothingStrength: 0,
      preserveSmallDetails: true,
    });
    expect(findConnectedComponents(result.colorIndex, 80, 80)).toHaveLength(1);
  });

  it('keeps a thin high-contrast line even when it joins a much larger region', () => {
    const rgba = image(80, 80, (x, y) =>
      y < 25 || (x === 40 && y < 70) ? [10, 14, 18, 255] : [245, 243, 238, 255],
    );
    const withoutProtection = simplifyImage(rgba, 80, 80, {
      ...baseSettings,
      detail: 'balanced',
      smoothingStrength: 0.3,
    });
    const withProtection = simplifyImage(rgba, 80, 80, {
      ...baseSettings,
      detail: 'balanced',
      smoothingStrength: 0.3,
      preserveSmallDetails: true,
    });

    expect(withoutProtection.colorIndex[60 * 80 + 40]).toBe(
      withoutProtection.colorIndex[60 * 80 + 45],
    );
    expect(withProtection.colorIndex[60 * 80 + 40]).not.toBe(
      withProtection.colorIndex[60 * 80 + 45],
    );
  });

  it('keeps transparent pixels outside the punchable pattern', () => {
    const rgba = image(8, 8, (x, y) =>
      x >= 2 && x <= 5 && y >= 2 && y <= 5 ? [100, 120, 140, 255] : [0, 0, 0, 0],
    );
    const result = simplifyImage(rgba, 8, 8, baseSettings);
    expect(result.heightIndex[0]).toBe(-1);
    expect(result.colorIndex[0]).toBe(-1);
    expect(result.heightIndex[3 * 8 + 3]).toBe(0);
  });

  it('rejects an entirely transparent image instead of producing a blank pattern', () => {
    const rgba = image(8, 8, () => [0, 0, 0, 0]);
    expect(() => simplifyImage(rgba, 8, 8, baseSettings)).toThrow(/no visible pixels/i);
  });

  it('uses physical needle width to simplify a narrow stripe', () => {
    const rgba = image(40, 40, (x) => (x === 20 ? [20, 30, 220, 255] : [220, 180, 35, 255]));
    const withoutNeedle = simplifyImage(rgba, 40, 40, {
      ...baseSettings,
      detail: 'fine',
      smoothingStrength: 0,
    });
    const withNeedle = simplifyImage(rgba, 40, 40, {
      ...baseSettings,
      detail: 'fine',
      smoothingStrength: 0,
      needleGeometry: { diameterMm: 20, throwMm: 0 },
      patternDimensions: { widthCm: 10, heightCm: 10 },
    });
    expect(findConnectedComponents(withoutNeedle.colorIndex, 40, 40).length).toBeGreaterThan(1);
    expect(findConnectedComponents(withNeedle.colorIndex, 40, 40)).toHaveLength(1);
  });
});
