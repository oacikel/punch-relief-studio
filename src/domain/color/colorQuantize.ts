/**
 * Deterministic color quantization for the "source-material" color mode:
 * reduce a captured-surface-color raster to a small yarn palette (2-12
 * swatches) in a perceptually reasonable space (CIE Lab), then merge tiny
 * color islands into a neighbor before finalizing swatches.
 *
 * Determinism: k-means-style clustering with farthest-point seeding driven
 * by the app's fixed-seed Rng (src/domain/random.ts) rather than
 * Math.random(), and a bounded iteration count -- same input + palette size
 * always yields the same swatches and assignment.
 */
import { createRng, DEFAULT_SEED, type Rng } from '../random';
import type { Mask, RgbColor } from '../types';

export interface LabColor {
  l: number;
  a: number;
  b: number;
}

export function rgbToLab({ r, g, b }: RgbColor): LabColor {
  // sRGB -> linear
  const toLinear = (c: number): number => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const rl = toLinear(r);
  const gl = toLinear(g);
  const bl = toLinear(b);

  // linear sRGB -> XYZ (D65)
  const x = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375;
  const y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175;
  const z = rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041;

  const xn = x / 0.95047;
  const yn = y / 1.0;
  const zn = z / 1.08883;

  const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(xn);
  const fy = f(yn);
  const fz = f(zn);

  return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

export function labDistance(a: LabColor, b: LabColor): number {
  const dl = a.l - b.l;
  const da = a.a - b.a;
  const db = a.b - b.b;
  return Math.sqrt(dl * dl + da * da + db * db);
}

export interface ColorQuantizeResult {
  palette: RgbColor[];
  /** Palette index per pixel, -1 for background. */
  assignment: Int16Array;
}

/**
 * Reduce foreground pixel colors to `paletteSize` swatches.
 */
export function quantizeColors(
  rgbaOrRgb: Uint8ClampedArray,
  channels: 3 | 4,
  mask: Mask,
  paletteSize: number,
  seed: number = DEFAULT_SEED,
): ColorQuantizeResult {
  if (paletteSize < 2 || paletteSize > 12) {
    throw new RangeError(`paletteSize must be between 2 and 12, got ${paletteSize}`);
  }
  const pixelCount = mask.width * mask.height;
  const labs: LabColor[] = new Array(pixelCount);
  const foregroundIndices: number[] = [];

  for (let i = 0; i < pixelCount; i++) {
    if (mask.data[i] !== 1) continue;
    const base = i * channels;
    const color: RgbColor = {
      r: rgbaOrRgb[base] ?? 0,
      g: rgbaOrRgb[base + 1] ?? 0,
      b: rgbaOrRgb[base + 2] ?? 0,
    };
    labs[i] = rgbToLab(color);
    foregroundIndices.push(i);
  }

  if (foregroundIndices.length === 0) {
    return { palette: [], assignment: new Int16Array(pixelCount).fill(-1) };
  }

  const k = Math.min(paletteSize, foregroundIndices.length);
  const rng = createRng(seed);
  const centroids = farthestPointSeed(labs, foregroundIndices, k, rng);

  const assignment = new Int16Array(pixelCount).fill(-1);
  const MAX_ITERATIONS = 20;
  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let changed = false;
    for (const i of foregroundIndices) {
      const lab = labs[i] as LabColor;
      let best = 0;
      let bestDist = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const d = labDistance(lab, centroids[c] as LabColor);
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
      }
      if (assignment[i] !== best) {
        assignment[i] = best;
        changed = true;
      }
    }
    // Recompute centroids as the mean of assigned points (deterministic
    // order: foregroundIndices is already a fixed row-major order).
    const sums = centroids.map(() => ({ l: 0, a: 0, b: 0, count: 0 }));
    for (const i of foregroundIndices) {
      const c = assignment[i] as number;
      const lab = labs[i] as LabColor;
      const s = sums[c] as { l: number; a: number; b: number; count: number };
      s.l += lab.l;
      s.a += lab.a;
      s.b += lab.b;
      s.count += 1;
    }
    for (let c = 0; c < centroids.length; c++) {
      const s = sums[c] as { l: number; a: number; b: number; count: number };
      if (s.count > 0) {
        centroids[c] = { l: s.l / s.count, a: s.a / s.count, b: s.b / s.count };
      }
    }
    if (!changed) break;
  }

  const palette = centroids.map(labToRgb);
  return { palette, assignment };
}

function farthestPointSeed(labs: LabColor[], indices: number[], k: number, rng: Rng): LabColor[] {
  const first = indices[rng.nextInt(indices.length)] as number;
  const chosen: LabColor[] = [labs[first] as LabColor];
  const chosenSet = new Set<number>([first]);

  while (chosen.length < k) {
    let farthestIdx = -1;
    let farthestDist = -1;
    for (const i of indices) {
      if (chosenSet.has(i)) continue;
      const lab = labs[i] as LabColor;
      let minDist = Infinity;
      for (const c of chosen) {
        const d = labDistance(lab, c);
        if (d < minDist) minDist = d;
      }
      if (minDist > farthestDist) {
        farthestDist = minDist;
        farthestIdx = i;
      }
    }
    if (farthestIdx === -1) break;
    chosen.push(labs[farthestIdx] as LabColor);
    chosenSet.add(farthestIdx);
  }
  return chosen;
}

function labToRgb(lab: LabColor): RgbColor {
  const fy = (lab.l + 16) / 116;
  const fx = fy + lab.a / 500;
  const fz = fy - lab.b / 200;

  const fInv = (t: number): number => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
  const xn = fInv(fx) * 0.95047;
  const yn = fInv(fy) * 1.0;
  const zn = fInv(fz) * 1.08883;

  const r = xn * 3.2404542 + yn * -1.5371385 + zn * -0.4985314;
  const g = xn * -0.969266 + yn * 1.8760108 + zn * 0.041556;
  const b = xn * 0.0556434 + yn * -0.2040259 + zn * 1.0572252;

  const toSrgb = (c: number): number => {
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.round(Math.min(255, Math.max(0, v * 255)));
  };
  return { r: toSrgb(r), g: toSrgb(g), b: toSrgb(b) };
}
