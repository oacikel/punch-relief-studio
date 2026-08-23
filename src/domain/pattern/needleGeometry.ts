/**
 * Needle-geometry width constraint (docs/ITERATION_04_PLAN.md). A punch
 * needle's diameter and throw (max shaft length) jointly limit how narrow a
 * region can be at a given pile height: shorter loops (relative to the
 * needle's diameter) need a proportionally wider region to read as a
 * distinct punched shape once finished -- this single number also absorbs
 * the "double-pass for reverse-side continuity" compensation a crafter
 * would otherwise need to apply by hand, per explicit product-owner
 * direction (the pattern's width is the only signal surfaced -- no
 * separate pass-count concept anywhere in this codebase).
 *
 * Deliberately not wired into `CalibrationProfile` -- these two fields are
 * a direct-mm-input stepping stone ahead of a future, more general needle/
 * yarn profile concept (see docs/ITERATION_04_PLAN.md §6).
 */
import { cm, cmToPx } from '../units';

export interface NeedleGeometry {
  /** Needle shaft diameter, in mm. 0 means "not set". */
  diameterMm: number;
  /** Needle's maximum shaft/throw length, in mm. 0 means "not set". */
  throwMm: number;
}

export const DEFAULT_NEEDLE_GEOMETRY: NeedleGeometry = { diameterMm: 0, throwMm: 0 };

/** Fraction of the needle's raw throw that's practically usable as loop
 * height -- "roughly half of it," per the product owner's own punching
 * experience (a 4cm-throw needle, not used to the full extent). */
export const PRACTICAL_THROW_FRACTION = 0.5;

/** Minimum-width multiplier at the tallest usable loop height -- a tall
 * loop already covers well; ~1x the needle diameter is enough. */
export const MIN_WIDTH_MULTIPLIER_TALL = 1;

/** Minimum-width multiplier at the shortest usable loop height (== the
 * needle diameter itself). Placeholder within the product owner's own
 * "somewhere between 1x and 3x, I'll adjust as I get more experience"
 * range -- deliberately not exposed as a tunable control yet (see
 * docs/ITERATION_04_PLAN.md §6). Lowered twice now: an initial 2.5, then
 * 1.75 after real-needle testing (2.2mm diameter), then 1.4 on explicit
 * further feedback that even 1.75x was still more conservative than
 * necessary -- see docs/DECISIONS.md. That second round of feedback came
 * in the same conversation that also found the `type="number"` locale
 * bug (see `src/domain/numberInput.ts`), which had been silently zeroing
 * out comma-typed values during earlier testing -- some of what motivated
 * this specific number may have been the bug, not the constant, so it's
 * worth re-checking against a clean baseline rather than assumed settled. */
export const MIN_WIDTH_MULTIPLIER_SHORT = 1.4;

/** Loop-height-to-diameter ratio at or above which a loop counts as fully
 * "tall" (gets `MIN_WIDTH_MULTIPLIER_TALL`) -- e.g. a ratio of 2.5 means a
 * loop 2.5x taller than the needle is wide is already generous enough that
 * more height buys no further width relief. Below this, the multiplier
 * interpolates linearly between `_SHORT` (at ratio 1, i.e. loop height ==
 * diameter, the physical floor) and `_TALL`. This is what makes a
 * generously-long needle (large `throwMm` relative to `diameterMm`)
 * actually earn a less aggressive floor across *more* of the pattern's
 * pile-height levels -- see the "ratio-based, not level-index-based"
 * correction in docs/DECISIONS.md for why the previous version of this
 * formula didn't. Lowered from an initial 4 to 2.5 in the same real-needle
 * tuning pass as `MIN_WIDTH_MULTIPLIER_SHORT` above -- a lower cap means
 * more of a pattern's levels reach the lenient multiplier sooner. */
export const LOOP_HEIGHT_RATIO_CAP = 2.5;

/** `false` for the default/all-zero geometry (and any non-positive input)
 * -- callers use this to skip the constraint entirely rather than apply a
 * fabricated floor derived from a needle nobody described. */
export function isNeedleGeometrySet(geometry: NeedleGeometry): boolean {
  return geometry.diameterMm > 0 && geometry.throwMm > 0;
}

/** The tallest practically-usable loop height for this needle. Guarded to
 * never return less than `diameterMm` (a needle can't produce a loop
 * shorter than itself), which is what makes the min/max range in
 * `minWidthMultiplierForLevel` well-formed even for an unusually stubby
 * `throwMm`. */
function maxLoopHeightMm(geometry: NeedleGeometry): number {
  return Math.max(geometry.diameterMm, geometry.throwMm * PRACTICAL_THROW_FRACTION);
}

/** Loop height in mm for pile-height level `levelIndex` of `levelCount`
 * (0-based, 0 = shortest/lowest pile), linearly interpolated between the
 * needle diameter (shortest usable loop) and its practical max throw
 * (tallest). `levelCount <= 1` is degenerate for this app (`ReliefSettings`
 * requires at least 2 levels) and returns the max, since there's no range
 * to interpolate across. */
export function loopHeightMmForLevel(
  levelIndex: number,
  levelCount: number,
  geometry: NeedleGeometry,
): number {
  const minHeight = geometry.diameterMm;
  const maxHeight = maxLoopHeightMm(geometry);
  if (levelCount <= 1) return maxHeight;
  const t = clamp01(levelIndex / (levelCount - 1));
  return minHeight + (maxHeight - minHeight) * t;
}

/** Minimum region width in mm for pile-height level `levelIndex`, given
 * this needle's geometry -- scales from `MIN_WIDTH_MULTIPLIER_SHORT x
 * diameterMm` at `loopHeight == diameterMm` (ratio 1, the physical floor)
 * down to `MIN_WIDTH_MULTIPLIER_TALL x diameterMm` once `loopHeight`
 * reaches `LOOP_HEIGHT_RATIO_CAP` times the diameter.
 *
 * Driven by the *ratio* of this level's actual loop height to the
 * diameter, not by the level's position in the index range. This matters:
 * an earlier version derived the multiplier from the same `i /
 * (levelCount - 1)` fraction `loopHeightMmForLevel` already uses to place
 * the loop height within [diameterMm, max], which meant the two `t`s were
 * algebraically identical and `throwMm`'s actual magnitude cancelled out
 * of the result entirely (found when a real needle spec -- 2.2mm
 * diameter, 40mm throw, a very generous ratio -- produced an unexpectedly
 * coarse pattern; see docs/DECISIONS.md). Recomputing from the ratio
 * instead means a needle with a long throw relative to its diameter
 * correctly earns a lenient (near-`_TALL`) multiplier across *most* of its
 * levels, not just asymptotically at the very top one. */
export function minWidthMmForLevel(
  levelIndex: number,
  levelCount: number,
  geometry: NeedleGeometry,
): number {
  const loopHeight = loopHeightMmForLevel(levelIndex, levelCount, geometry);
  const ratio = loopHeight / geometry.diameterMm; // always >= 1
  const t = clamp01((ratio - 1) / (LOOP_HEIGHT_RATIO_CAP - 1));
  const multiplier =
    MIN_WIDTH_MULTIPLIER_SHORT - (MIN_WIDTH_MULTIPLIER_SHORT - MIN_WIDTH_MULTIPLIER_TALL) * t;
  return multiplier * geometry.diameterMm;
}

/** Converts `minWidthMmForLevel`'s physical width into raster pixels, for
 * enforcement as a local-thickness (morphological opening) check -- see
 * `applyNeedleWidthOpening` in `src/domain/regionCleanup.ts`. `pxPerCm` is
 * the average of the two axes' density, since the square capture raster
 * and a non-square physical Width/Height can disagree per axis; averaging
 * keeps a single threshold rather than picking one axis arbitrarily.
 * Returns 0 (no additional floor) if the geometry is unset or the physical
 * dimensions are non-positive. */
export function minWidthPxForLevel(
  levelIndex: number,
  levelCount: number,
  geometry: NeedleGeometry,
  widthCm: number,
  heightCm: number,
  rasterWidthPx: number,
  rasterHeightPx: number,
): number {
  if (!isNeedleGeometrySet(geometry)) return 0;
  if (widthCm <= 0 || heightCm <= 0 || rasterWidthPx <= 0 || rasterHeightPx <= 0) return 0;
  const pxPerCmX = rasterWidthPx / widthCm;
  const pxPerCmY = rasterHeightPx / heightCm;
  const pxPerCm = (pxPerCmX + pxPerCmY) / 2;
  const minWidthCm = cm(minWidthMmForLevel(levelIndex, levelCount, geometry) / 10);
  return cmToPx(minWidthCm, pxPerCm);
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
