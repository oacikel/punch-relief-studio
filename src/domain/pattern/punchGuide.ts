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

/**
 * Hard safety ceiling on how many dots a single guide will ever render.
 * At the minimum spacing (0.2cm) a large physical pattern (say 100cm x
 * 100cm, a realistic punch-needle rug size) would naively produce well
 * over a million `<circle>` elements, computed synchronously on every
 * render of the on-screen Preview -- a real UI-stall risk found during
 * implementation review, not a case this module can assume away. When the
 * naive grid would exceed this cap, `computePunchGuideDots` widens the
 * *effective* spacing just enough to stay under it, rather than either
 * throwing (crashing the Preview stage) or silently truncating the grid
 * (which would draw a guide that quietly stops partway across the
 * pattern, actively misleading a crafter using it for placement). Because
 * spacing only ever widens, never narrows, in the fallback case, an
 * enforced dot is never closer to its neighbors than the user asked for.
 */
export const MAX_PUNCH_GUIDE_DOTS = 20_000;

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

  const effectiveSpacingCm = widenSpacingToStayUnderDotCap(widthCm, heightCm, spacingCm);

  const dots: PunchGuideDotPx[] = [];
  const half = effectiveSpacingCm / 2;
  for (let row = 0, yCm = half; yCm < heightCm; row++, yCm = half + row * effectiveSpacingCm) {
    for (let col = 0, xCm = half; xCm < widthCm; col++, xCm = half + col * effectiveSpacingCm) {
      dots.push({ x: cmToPx(cm(xCm), pxPerCm), y: cmToPx(cm(yCm), pxPerCm) });
    }
  }
  return dots;
}

/**
 * Estimate the naive dot count for a given spacing and, if it would exceed
 * `MAX_PUNCH_GUIDE_DOTS`, scale spacing up by the same factor in both
 * dimensions (i.e. by `sqrt(estimatedCount / MAX_PUNCH_GUIDE_DOTS)`) so the
 * actual grid stays at or under the cap. A no-op well under the cap.
 */
function widenSpacingToStayUnderDotCap(
  widthCm: number,
  heightCm: number,
  spacingCm: number,
): number {
  const estimatedCols = Math.ceil(widthCm / spacingCm);
  const estimatedRows = Math.ceil(heightCm / spacingCm);
  const estimatedCount = estimatedCols * estimatedRows;
  if (estimatedCount <= MAX_PUNCH_GUIDE_DOTS) return spacingCm;
  return spacingCm * Math.sqrt(estimatedCount / MAX_PUNCH_GUIDE_DOTS);
}
