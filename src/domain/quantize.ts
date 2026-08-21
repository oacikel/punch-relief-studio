/**
 * Quantize a continuous [0,1] relief field into a small number of discrete
 * height levels. Two deterministic modes: equal-interval (fixed-width
 * bands) and quantile (data-driven, equal pixel count per band). Both are
 * pure and depend only on the input array and settings -- no wall-clock,
 * no Math.random().
 */
import type { HeightLevel, Mask, QuantizationMode, ScalarField } from './types';
import { clamp01, normalizedDepth, type NormalizedDepth } from './units';

export interface QuantizeResult {
  /** Height level index per pixel, -1 for background. */
  heightIndex: Int16Array;
  levels: HeightLevel[];
}

export function computeLevelBounds(
  levels: number,
  mode: QuantizationMode,
  field: ScalarField,
  mask: Mask,
): HeightLevel[] {
  if (levels < 2 || levels > 12) {
    throw new RangeError(`levels must be between 2 and 12, got ${levels}`);
  }
  if (mode === 'equal-interval') {
    return equalIntervalBounds(levels);
  }
  return quantileBounds(levels, field, mask);
}

function equalIntervalBounds(levels: number): HeightLevel[] {
  const step = 1 / levels;
  const bounds: HeightLevel[] = [];
  for (let i = 0; i < levels; i++) {
    bounds.push({
      index: i,
      lowerBound: normalizedDepth(i * step),
      upperBound: normalizedDepth(i === levels - 1 ? 1 : (i + 1) * step),
    });
  }
  return bounds;
}

/** Equal pixel-count bands, computed deterministically from a sorted copy
 * of the foreground values. Ties are broken by array order, which is
 * itself deterministic (row-major scan), so repeat runs are bit-identical. */
function quantileBounds(levels: number, field: ScalarField, mask: Mask): HeightLevel[] {
  const values: number[] = [];
  for (let i = 0; i < mask.data.length; i++) {
    if (mask.data[i] === 1) values.push(field.data[i] as number);
  }
  if (values.length === 0) {
    return equalIntervalBounds(levels);
  }
  values.sort((a, b) => a - b);

  // Build lower bounds first (band 0 always starts at 0), bumping any
  // collision by a tiny epsilon so the sequence is strictly increasing --
  // this matters for degenerate (all-equal-value, or heavily repeated
  // percentile) input. Upper bounds are then derived as *exactly* the next
  // band's lower bound (band `levels-1` ends at 1), so bands are
  // contiguous by construction and can never leave a gap that
  // levelIndexForValue would silently misassign (see implementation review
  // finding recorded in docs/PLAN_REVIEW.md-equivalent notes).
  const lowerBounds: number[] = [0];
  for (let i = 1; i < levels; i++) {
    const idx = Math.min(Math.floor((i / levels) * values.length), values.length - 1);
    const candidate = values[idx] as number;
    const prev = lowerBounds[i - 1] as number;
    lowerBounds.push(candidate > prev ? candidate : prev + 1e-6);
  }

  const bounds: HeightLevel[] = [];
  for (let i = 0; i < levels; i++) {
    const lower = lowerBounds[i] as number;
    const upper = i === levels - 1 ? 1 : (lowerBounds[i + 1] as number);
    bounds.push({
      index: i,
      lowerBound: normalizedDepth(lower),
      upperBound: normalizedDepth(upper),
    });
  }
  return bounds;
}

export function quantize(field: ScalarField, mask: Mask, levels: HeightLevel[]): QuantizeResult {
  const heightIndex = new Int16Array(field.data.length).fill(-1);
  for (let i = 0; i < field.data.length; i++) {
    if (mask.data[i] !== 1) continue;
    const v = clamp01(field.data[i] as number) as NormalizedDepth;
    heightIndex[i] = levelIndexForValue(v, levels);
  }
  return { heightIndex, levels };
}

export function levelIndexForValue(value: NormalizedDepth, levels: HeightLevel[]): number {
  for (let i = 0; i < levels.length; i++) {
    const level = levels[i] as HeightLevel;
    const isLast = i === levels.length - 1;
    if (
      value >= level.lowerBound &&
      (isLast ? value <= level.upperBound : value < level.upperBound)
    ) {
      return level.index;
    }
  }
  // Numerical edge case (value exactly 1 with float rounding): clamp to top.
  return (levels[levels.length - 1] as HeightLevel).index;
}
