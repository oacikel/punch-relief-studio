/**
 * Continuous relief field processing: foreground masking, depth
 * normalization, inversion, intensity scaling, and edge-aware smoothing.
 * Pure functions, no DOM/Three.js -- operate on plain typed arrays so they
 * are unit-testable without a browser and safe to run inside a Web Worker.
 */
import type { Mask, ScalarField } from './types';
import { clamp01, type NormalizedDepth } from './units';

/**
 * Build a foreground mask from a raw camera-space depth buffer. `emptyValue`
 * is the sentinel the depth capture uses for "no geometry hit this pixel"
 * (e.g. the camera far-plane value or NaN).
 */
export function buildForegroundMask(
  depth: Float32Array,
  width: number,
  height: number,
  emptyValue: number,
): Mask {
  const data = new Uint8Array(width * height);
  for (let i = 0; i < data.length; i++) {
    const v = depth[i];
    data[i] = v !== undefined && Number.isFinite(v) && v !== emptyValue ? 1 : 0;
  }
  return { width, height, data };
}

export class NoForegroundPixelsError extends Error {
  constructor() {
    super(
      'No foreground pixels were captured from this viewpoint. The model may be ' +
        'outside the camera frustum, fully transparent, or degenerate. Try ' +
        '"Fit to view" or a different orientation.',
    );
    this.name = 'NoForegroundPixelsError';
  }
}

/**
 * Normalize raw depth to [0,1] using only foreground pixels for min/max, so
 * background does not skew the range. Nearer-to-camera = smaller raw depth
 * is assumed (standard camera-space convention); output 1.0 = nearest by
 * default (inversion handled separately by `invertRelief`).
 */
export function normalizeDepth(depth: Float32Array, mask: Mask): ScalarField {
  let min = Infinity;
  let max = -Infinity;
  let any = false;
  for (let i = 0; i < mask.data.length; i++) {
    if (mask.data[i] === 1) {
      const v = depth[i] as number;
      any = true;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (!any) throw new NoForegroundPixelsError();

  const range = max - min;
  const data = new Float32Array(depth.length);
  for (let i = 0; i < data.length; i++) {
    if (mask.data[i] !== 1) {
      data[i] = 0;
      continue;
    }
    const v = depth[i] as number;
    // Nearer surface (smaller raw depth) -> higher normalized value.
    const normalized = range > 0 ? 1 - (v - min) / range : 1;
    data[i] = clamp01(normalized);
  }
  return { width: mask.width, height: mask.height, data };
}

/** Flip near/far mapping: near-to-high (default) vs near-to-low. */
export function invertRelief(field: ScalarField, invert: boolean): ScalarField {
  if (!invert) return field;
  const data = new Float32Array(field.data.length);
  for (let i = 0; i < data.length; i++) data[i] = 1 - (field.data[i] as number);
  return { width: field.width, height: field.height, data };
}

/** Scale relief around a fixed baseline of 0 so intensity=0 flattens to the
 * mask's mean height and intensity=1 is the untouched field. */
export function applyIntensity(field: ScalarField, mask: Mask, intensity: number): ScalarField {
  const t = clamp01(intensity);
  let sum = 0;
  let count = 0;
  for (let i = 0; i < mask.data.length; i++) {
    if (mask.data[i] === 1) {
      sum += field.data[i] as number;
      count++;
    }
  }
  const mean = count > 0 ? sum / count : 0.5;
  const data = new Float32Array(field.data.length);
  for (let i = 0; i < data.length; i++) {
    if (mask.data[i] !== 1) {
      data[i] = 0;
      continue;
    }
    const v = field.data[i] as number;
    data[i] = clamp01(mean + (v - mean) * t);
  }
  return { width: field.width, height: field.height, data };
}

/**
 * Edge-aware smoothing: a separable box blur blended with the original
 * field by `edgePreservation` acting as a per-pixel gradient-magnitude
 * threshold (simple, deterministic bilateral approximation -- not a true
 * bilateral filter, which would be far more expensive for marginal gain at
 * this output resolution).
 */
export function smoothRelief(
  field: ScalarField,
  mask: Mask,
  strength: number,
  edgePreservation: number,
): ScalarField {
  const s = clamp01(strength);
  if (s === 0) return field;
  const radius = Math.max(1, Math.round(s * 4));
  const blurred = boxBlur(field, mask, radius);
  const edgeThreshold = clamp01(edgePreservation) * 0.5;

  const data = new Float32Array(field.data.length);
  for (let y = 0; y < field.height; y++) {
    for (let x = 0; x < field.width; x++) {
      const i = y * field.width + x;
      if (mask.data[i] !== 1) {
        data[i] = 0;
        continue;
      }
      const gradient = localGradient(field, mask, x, y);
      // Near a strong edge, keep more of the original value.
      const blend = gradient > edgeThreshold ? s * 0.35 : s;
      data[i] = clamp01(
        (field.data[i] as number) * (1 - blend) + (blurred.data[i] as number) * blend,
      );
    }
  }
  return { width: field.width, height: field.height, data };
}

function localGradient(field: ScalarField, mask: Mask, x: number, y: number): number {
  const { width, height, data } = field;
  const at = (xx: number, yy: number): number => {
    const cx = Math.min(width - 1, Math.max(0, xx));
    const cy = Math.min(height - 1, Math.max(0, yy));
    const i = cy * width + cx;
    return mask.data[i] === 1 ? (data[i] as number) : (data[y * width + x] as number);
  };
  const dx = at(x + 1, y) - at(x - 1, y);
  const dy = at(x, y + 1) - at(x, y - 1);
  return Math.sqrt(dx * dx + dy * dy);
}

function boxBlur(field: ScalarField, mask: Mask, radius: number): ScalarField {
  const { width, height, data } = field;
  const out = new Float32Array(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (mask.data[i] !== 1) {
        out[i] = 0;
        continue;
      }
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= width) continue;
          const j = yy * width + xx;
          if (mask.data[j] === 1) {
            sum += data[j] as number;
            count++;
          }
        }
      }
      out[i] = count > 0 ? sum / count : (data[i] as number);
    }
  }
  return { width, height, data: out };
}

export function fieldValueAt(field: ScalarField, x: number, y: number): NormalizedDepth {
  return field.data[y * field.width + x] as NormalizedDepth;
}
