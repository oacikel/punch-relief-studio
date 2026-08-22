/**
 * "Smallest punchable region" presets (docs/ITERATION_03_PLAN.md #1).
 *
 * The control that feeds `cleanupTinyRegions` (src/domain/regionCleanup.ts)
 * runs during relief generation in the Worker, *before* the app ever asks
 * for a physical Width/Height (that only exists later, on the Export
 * panel) -- so a physical-unit (cm/mm) control would have no real scale to
 * convert against at the point it's actually used. Expressing the
 * threshold as a percentage of the raster canvas area instead keeps it
 * meaningful regardless of which raster resolution processed the model,
 * without ever fabricating a physical measurement (per CLAUDE.md's units
 * discipline).
 */

export type MinRegionPreset = 'fine' | 'balanced' | 'bold';

export const MIN_REGION_PRESET_ORDER: MinRegionPreset[] = ['fine', 'balanced', 'bold'];

export const MIN_REGION_PRESET_LABELS: Record<MinRegionPreset, string> = {
  fine: 'Fine detail',
  balanced: 'Balanced',
  bold: 'Bold & simple',
};

export const MIN_REGION_PRESET_DESCRIPTIONS: Record<MinRegionPreset, string> = {
  fine: 'Keeps small isolated areas -- more detail, more tiny regions to punch.',
  balanced: 'Removes only the tiniest slivers -- a good default for most patterns.',
  bold: 'Removes small areas more aggressively for a simpler, easier-to-punch pattern.',
};

/** Fraction of the raster canvas area (width * height, in pixels) below
 * which a connected region is cleaned up. "Balanced" reproduces roughly
 * today's previous fixed default (12px at the hardcoded 256x256
 * resolution, see docs/DECISIONS.md) so existing patterns don't visibly
 * change under the new default preset. */
const MIN_REGION_PRESET_PERCENT: Record<MinRegionPreset, number> = {
  fine: 0.0001, // 0.01%
  balanced: 0.0002, // 0.02%
  bold: 0.0008, // 0.08%
};

/** Convert a preset + raster dimensions into the actual pixel-count
 * threshold `cleanupTinyRegions`/`findSmallRegions` expect. Always at
 * least 1px, so a preset never silently becomes a no-op cleanup pass. */
export function minRegionPxForPreset(
  preset: MinRegionPreset,
  width: number,
  height: number,
): number {
  const percent = MIN_REGION_PRESET_PERCENT[preset];
  return Math.max(1, Math.round(width * height * percent));
}
