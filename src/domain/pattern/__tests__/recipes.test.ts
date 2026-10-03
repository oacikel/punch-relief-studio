import { describe, expect, it } from 'vitest';
import { PATTERN_RECIPES, getRecipeById } from '../recipes';
import { getPaletteById } from '@/domain/color/palettes';
import { MIN_REGION_PRESET_ORDER } from '@/domain/pattern/minRegionPreset';

describe('PATTERN_RECIPES', () => {
  it('names exactly five recipes, per the EXP-012 task brief', () => {
    expect(PATTERN_RECIPES).toHaveLength(5);
  });

  it('has unique ids and names', () => {
    expect(new Set(PATTERN_RECIPES.map((r) => r.id)).size).toBe(PATTERN_RECIPES.length);
    expect(new Set(PATTERN_RECIPES.map((r) => r.name)).size).toBe(PATTERN_RECIPES.length);
  });

  it('references a real color-story palette and min-region preset for every recipe', () => {
    for (const recipe of PATTERN_RECIPES) {
      expect(getPaletteById(recipe.paletteId)).toBeDefined();
      expect(MIN_REGION_PRESET_ORDER).toContain(recipe.reliefSettings.minRegionPreset);
      expect(recipe.reliefSettings.levels).toBeGreaterThanOrEqual(2);
      expect(recipe.reliefSettings.levels).toBeLessThanOrEqual(12);
    }
  });
});

describe('getRecipeById', () => {
  it('finds a known recipe by id', () => {
    expect(getRecipeById('cozy-terrain')?.name).toBe('Cozy Terrain');
  });

  it('returns undefined for an unknown id', () => {
    expect(getRecipeById('not-a-real-recipe')).toBeUndefined();
  });
});
