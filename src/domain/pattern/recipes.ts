/**
 * EXP-012 ("One-click pattern recipes that preset shape, detail and yarn
 * palette") -- a small, bundled set of named presets a maker can apply in
 * one click instead of tuning "Shape the relief" (levels/intensity), "Punch
 * detail" (`minRegionPreset`) and a yarn color story separately across the
 * Workspace rail's three steps. Deliberately not configurable or
 * extensible from the UI -- same "small, bundled, local dataset" posture as
 * `COLOR_STORY_PALETTES` (docs/ITERATION_03_PLAN.md #7), just one layer up:
 * each recipe names a `ReliefSettings` patch plus a `COLOR_STORY_PALETTES`
 * id, rather than inventing a second palette format.
 *
 * `levels` is required (not left to whatever `ReliefSettings` already has)
 * because applying a recipe also needs to build exactly that many by-height
 * swatches up front -- see `App.tsx`'s `handleApplyRecipe`, which can't
 * wait for the next relief regeneration to know the swatch count the way a
 * manual "Yarn" step edit safely can.
 */
import type { ReliefSettings } from '@/domain/types';
import type { MinRegionPreset } from '@/domain/pattern/minRegionPreset';

export interface PatternRecipe {
  id: string;
  name: string;
  description: string;
  reliefSettings: Partial<ReliefSettings> & {
    levels: number;
    minRegionPreset: MinRegionPreset;
  };
  /** A `COLOR_STORY_PALETTES` id (src/domain/color/palettes.ts). */
  paletteId: string;
}

export const PATTERN_RECIPES: PatternRecipe[] = [
  {
    id: 'cozy-terrain',
    name: 'Cozy Terrain',
    description: 'A gentle, earthy topographic look -- four pile heights, balanced detail.',
    reliefSettings: {
      levels: 4,
      intensity: 0.7,
      smoothingStrength: 0.4,
      minRegionPreset: 'balanced',
    },
    paletteId: 'terrain',
  },
  {
    id: 'crisp-coastal',
    name: 'Crisp Coastal',
    description: 'Lots of fine height steps in cool ocean-to-sky blues.',
    reliefSettings: { levels: 8, intensity: 0.6, smoothingStrength: 0.2, minRegionPreset: 'fine' },
    paletteId: 'coastal',
  },
  {
    id: 'bold-sunset',
    name: 'Bold Sunset',
    description: 'Dramatic, simplified depth -- just three heights -- in a warm sunset gradient.',
    reliefSettings: { levels: 3, intensity: 1, smoothingStrength: 0.3, minRegionPreset: 'bold' },
    paletteId: 'sunset',
  },
  {
    id: 'playful-meadow',
    name: 'Playful Meadow',
    description: 'High-contrast, detailed florals over green -- six pile heights.',
    reliefSettings: { levels: 6, intensity: 0.8, smoothingStrength: 0.3, minRegionPreset: 'fine' },
    paletteId: 'meadow',
  },
  {
    id: 'simple-starter',
    name: 'Simple Starter',
    description: 'The easiest possible first pattern -- two pile heights, calm coastal blues.',
    reliefSettings: { levels: 2, intensity: 0.5, smoothingStrength: 0.4, minRegionPreset: 'bold' },
    paletteId: 'coastal',
  },
];

export function getRecipeById(id: string): PatternRecipe | undefined {
  return PATTERN_RECIPES.find((recipe) => recipe.id === id);
}
