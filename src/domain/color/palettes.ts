/**
 * Hand-picked yarn "color story" palettes (docs/ITERATION_03_PLAN.md #7).
 * A small, bundled, local dataset -- no network calls, per CLAUDE.md --
 * that a user can apply to color-by-height regions in one click. Individual
 * swatches stay hand-editable afterward exactly as before; applying a
 * palette only sets `color`, never touches `index`/`yarnName`.
 */
import type { ColorSwatch, RgbColor } from '@/domain/types';

export interface ColorStoryPalette {
  id: string;
  name: string;
  description: string;
  colors: RgbColor[];
}

/** Deliberately small and tasteful -- a handful of named collections, not
 * a big palette-management system. Each has enough colors to stay
 * distinct across the full 2-12 height-level range (cycling via modulo
 * beyond that, same pattern as the DEFAULT_PALETTE fallback in
 * state/appState.ts). */
export const COLOR_STORY_PALETTES: ColorStoryPalette[] = [
  {
    id: 'terrain',
    name: 'Terrain',
    description: 'Earthy low-to-high bands, like a topographic map.',
    colors: [
      { r: 58, g: 82, b: 60 }, // deep forest
      { r: 107, g: 122, b: 70 }, // moss
      { r: 163, g: 148, b: 92 }, // dry grass
      { r: 196, g: 164, b: 116 }, // sand
      { r: 214, g: 197, b: 168 }, // pale clay
      { r: 233, g: 225, b: 210 }, // chalk / snowcap
    ],
  },
  {
    id: 'coastal',
    name: 'Coastal',
    description: 'Cool ocean-to-sky blues and sandy neutrals.',
    colors: [
      { r: 21, g: 61, b: 87 }, // deep sea
      { r: 41, g: 105, b: 130 }, // harbor blue
      { r: 92, g: 158, b: 173 }, // shallow water
      { r: 163, g: 201, b: 200 }, // sea foam
      { r: 224, g: 214, b: 185 }, // sand
      { r: 245, g: 240, b: 227 }, // driftwood white
    ],
  },
  {
    id: 'sunset',
    name: 'Sunset Fade',
    description: 'Warm gradient from deep plum through gold.',
    colors: [
      { r: 63, g: 30, b: 68 }, // plum
      { r: 130, g: 43, b: 74 }, // wine
      { r: 196, g: 74, b: 68 }, // ember
      { r: 224, g: 122, b: 63 }, // amber
      { r: 240, g: 172, b: 92 }, // marigold
      { r: 250, g: 214, b: 150 }, // pale gold
    ],
  },
  {
    id: 'meadow',
    name: 'Meadow',
    description: 'Bright florals over green -- playful, high-contrast.',
    colors: [
      { r: 55, g: 94, b: 58 }, // hedge green
      { r: 118, g: 158, b: 84 }, // spring green
      { r: 210, g: 196, b: 90 }, // buttercup
      { r: 212, g: 126, b: 148 }, // wild rose
      { r: 149, g: 104, b: 168 }, // lavender
      { r: 235, g: 233, b: 224 }, // linen
    ],
  },
];

export function getPaletteById(id: string): ColorStoryPalette | undefined {
  return COLOR_STORY_PALETTES.find((p) => p.id === id);
}

/**
 * Apply a palette's colors to an existing swatch list, cycling through
 * the palette's colors by swatch index (modulo) if there are more
 * swatches than palette colors. Preserves each swatch's `index` and
 * `yarnName` untouched -- only `color` changes -- so a user's yarn naming
 * survives a palette application, and individual swatches remain
 * hand-editable afterward exactly as before. A no-op (returns the input
 * unchanged) if the palette has no colors, so this can never divide by
 * zero or drop swatches.
 */
export function applyPaletteToSwatches(
  swatches: ColorSwatch[],
  palette: ColorStoryPalette,
): ColorSwatch[] {
  if (palette.colors.length === 0) return swatches;
  return swatches.map((swatch, i) => ({
    ...swatch,
    color: palette.colors[i % palette.colors.length] as RgbColor,
  }));
}
