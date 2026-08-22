/**
 * Pure geometry for the punch-guide dot overlay (Iteration 02 Stage C): an
 * optional grid of reference dots, spaced at a real physical distance the
 * user sets, so a crafter can gauge roughly where to place punch-needle
 * stitches on the on-screen pattern and on every SVG/PNG/print export.
 *
 * Deliberately a plain, full-canvas square grid -- not clipped to the
 * region silhouette, not hex-packed, no separate "density" control (the
 * dot spacing already *is* the density, inverted). This matches the
 * existing `showGrid` behavior in `src/export/svgPattern.ts` (`buildGrid`
 * also draws a full-canvas grid regardless of pattern shape), and keeps
 * this a minimal, honestly-labeled v1 rather than a speculative feature
 * the plan never asked for. See docs/DECISIONS.md for the full rationale.
 *
 * Every physical-length conversion here goes through the named
 * `cm`/`cmToPx` functions in `src/domain/units.ts`, never a bare
 * multiplication -- see CLAUDE.md's "Units discipline." This is the first
 * place in the app where a user-entered *physical* measurement (as opposed
 * to a computation/precision knob like output resolution) is converted to
 * raster pixels.
 */
import { cm, cmToPx, type Px } from '@/domain/units';

export type PunchGuideMode = 'none' | 'dots';

/** Below this, dots would be closer together than a punch needle's own
 * tip, making the overlay visual noise rather than a useful guide. */
export const MIN_PUNCH_GUIDE_SPACING_CM = 0.2;
/** Above this, a "guide" grid is so sparse it stops being useful for
 * gauging placement across a typical pattern. */
export const MAX_PUNCH_GUIDE_SPACING_CM = 5;
export const DEFAULT_PUNCH_GUIDE_SPACING_CM = 1;

export interface PunchGuideSettings {
  mode: PunchGuideMode;
  spacingCm: number;
}

export interface PunchGuideDotPx {
  x: Px;
  y: Px;
}

/**
 * Clamp a user-entered spacing value into the supported range, and fall
 * back to the default for non-finite input (e.g. a cleared number field)
 * rather than propagating NaN into the grid math below.
 */
export function clampPunchGuideSpacingCm(spacingCm: number): number {
  if (!Number.isFinite(spacingCm)) return DEFAULT_PUNCH_GUIDE_SPACING_CM;
  return Math.min(MAX_PUNCH_GUIDE_SPACING_CM, Math.max(MIN_PUNCH_GUIDE_SPACING_CM, spacingCm));
}

/**
 * Evenly-spaced square grid of dots across the full `widthCm` x `heightCm`
 * canvas, `spacingCm` real-world centimetres apart, converted to raster
 * pixels via the pattern's own pxPerCm density. Dots start half a spacing
 * in from the top-left edge so the grid reads as centered rather than
 * pinned to one corner.
 *
 * Each dot's physical (cm) coordinate is computed directly from its grid
 * index and converted to pixels individually via `cmToPx` -- not by
 * stepping in already-rounded pixel space -- so rounding never
 * accumulates across the grid.
 */
export function computePunchGuideDots(
  widthCm: number,
  heightCm: number,
  spacingCm: number,
  pxPerCm: number,
): PunchGuideDotPx[] {
  if (!(spacingCm > 0)) {
    throw new Error('spacingCm must be positive');
  }
  if (!(widthCm > 0) || !(heightCm > 0)) return [];

  const dots: PunchGuideDotPx[] = [];
  const half = spacingCm / 2;
  for (let row = 0, yCm = half; yCm < heightCm; row++, yCm = half + row * spacingCm) {
    for (let col = 0, xCm = half; xCm < widthCm; col++, xCm = half + col * spacingCm) {
      dots.push({ x: cmToPx(cm(xCm), pxPerCm), y: cmToPx(cm(yCm), pxPerCm) });
    }
  }
  return dots;
}
