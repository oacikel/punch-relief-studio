import { describe, expect, it } from 'vitest';
import {
  COLOR_STORY_PALETTES,
  applyPaletteToSwatches,
  getPaletteById,
  type ColorStoryPalette,
} from '../palettes';
import type { ColorSwatch } from '@/domain/types';

function makeSwatches(count: number): ColorSwatch[] {
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    color: { r: 0, g: 0, b: 0 },
    yarnName: `Yarn ${i + 1}`,
  }));
}

describe('COLOR_STORY_PALETTES', () => {
  it('is a small, non-empty, bundled dataset with at least a couple colors each', () => {
    expect(COLOR_STORY_PALETTES.length).toBeGreaterThan(1);
    expect(COLOR_STORY_PALETTES.length).toBeLessThan(10); // "small," per the brief
    for (const palette of COLOR_STORY_PALETTES) {
      expect(palette.colors.length).toBeGreaterThanOrEqual(2);
      expect(palette.id).toBeTruthy();
      expect(palette.name).toBeTruthy();
    }
  });

  it('has unique ids', () => {
    const ids = COLOR_STORY_PALETTES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('getPaletteById', () => {
  it('finds a known palette by id', () => {
    expect(getPaletteById('terrain')?.name).toBe('Terrain');
  });

  it('returns undefined for an unknown id', () => {
    expect(getPaletteById('not-a-real-palette')).toBeUndefined();
  });
});

describe('applyPaletteToSwatches', () => {
  const palette: ColorStoryPalette = {
    id: 'test',
    name: 'Test',
    description: '',
    colors: [
      { r: 1, g: 2, b: 3 },
      { r: 4, g: 5, b: 6 },
    ],
  };

  it('sets each swatch color from the palette, cycling by index', () => {
    const result = applyPaletteToSwatches(makeSwatches(4), palette);
    expect(result.map((s) => s.color)).toEqual([
      { r: 1, g: 2, b: 3 },
      { r: 4, g: 5, b: 6 },
      { r: 1, g: 2, b: 3 },
      { r: 4, g: 5, b: 6 },
    ]);
  });

  it('preserves index and yarnName untouched', () => {
    const swatches = makeSwatches(2);
    swatches[0] = { ...swatches[0], yarnName: 'My custom name' } as ColorSwatch;
    const result = applyPaletteToSwatches(swatches, palette);
    expect(result[0]?.yarnName).toBe('My custom name');
    expect(result[0]?.index).toBe(0);
    expect(result[1]?.index).toBe(1);
  });

  it('is a no-op when the palette has no colors, rather than throwing', () => {
    const empty: ColorStoryPalette = { id: 'empty', name: 'Empty', description: '', colors: [] };
    const swatches = makeSwatches(3);
    expect(applyPaletteToSwatches(swatches, empty)).toEqual(swatches);
  });

  it('handles fewer swatches than palette colors (uses only the first N)', () => {
    const result = applyPaletteToSwatches(makeSwatches(1), palette);
    expect(result).toEqual([{ index: 0, color: { r: 1, g: 2, b: 3 }, yarnName: 'Yarn 1' }]);
  });
});
