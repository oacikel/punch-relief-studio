import { quantizeColors, labDistance, rgbToLab } from '@/domain/color/colorQuantize';
import { findConnectedComponents, applyNeedleWidthOpening } from '@/domain/regionCleanup';
import { minimumZoneWidthPx } from '@/domain/pattern/needleGeometry';
import type { MinRegionPreset } from '@/domain/pattern/minRegionPreset';
import type { Mask, RgbColor } from '@/domain/types';
import type { NeedleGeometry } from '@/domain/pattern/needleGeometry';

export interface ImageSimplificationSettings {
  paletteSize: number;
  detail: MinRegionPreset;
  smoothingStrength: number;
  edgePreservation: number;
  seed: number;
  needleGeometry: NeedleGeometry;
  patternDimensions: { widthCm: number; heightCm: number };
}

export interface SimplifiedImage {
  width: number;
  height: number;
  heightIndex: Int16Array;
  colorIndex: Int16Array;
  palette: RgbColor[];
}

const MIN_REGION_FRACTION: Record<MinRegionPreset, number> = {
  fine: 0.0004,
  balanced: 0.0012,
  bold: 0.003,
};

const PRESET_RADIUS: Record<MinRegionPreset, number> = {
  fine: 0,
  balanced: 1,
  bold: 2,
};

/**
 * Convert a photograph or illustration into spatially coherent yarn zones.
 * The pipeline deliberately works on connected shapes, rather than merely
 * enlarging pixels: edge-aware smoothing removes texture, Lab quantization
 * finds a limited yarn palette, and connected regions are merged according
 * to both their shared boundary and perceptual color distance.
 */
export function simplifyImage(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  settings: ImageSimplificationSettings,
): SimplifiedImage {
  if (width <= 0 || height <= 0 || rgba.length !== width * height * 4) {
    throw new RangeError('Image dimensions do not match its RGBA pixel data.');
  }

  const mask = alphaMask(rgba, width, height);
  if (!mask.data.some((value) => value === 1)) {
    throw new Error('This image has no visible pixels to turn into a pattern.');
  }
  const smoothed = edgeAwareSmooth(
    rgba,
    mask,
    settings.smoothingStrength,
    settings.edgePreservation,
  );
  const quantized = quantizeColors(smoothed, 4, mask, settings.paletteSize, settings.seed);

  const minRegionPx = Math.max(
    2,
    Math.round(width * height * MIN_REGION_FRACTION[settings.detail]),
  );
  let colorIndex = mergeSmallColorRegions(
    quantized.assignment,
    width,
    height,
    quantized.palette,
    minRegionPx,
  );

  const needleWidthPx = minimumZoneWidthPx(
    settings.needleGeometry,
    settings.patternDimensions.widthCm,
    settings.patternDimensions.heightCm,
    width,
    height,
  );
  const radius = Math.max(PRESET_RADIUS[settings.detail], Math.round(needleWidthPx / 2));
  if (radius > 0) {
    colorIndex = applyNeedleWidthOpening(colorIndex, width, height, () => radius);
    colorIndex = mergeSmallColorRegions(colorIndex, width, height, quantized.palette, minRegionPx);
  }

  const compact = compactPalette(colorIndex, quantized.palette);
  const heightIndex = new Int16Array(width * height);
  for (let i = 0; i < heightIndex.length; i++) {
    heightIndex[i] = mask.data[i] === 1 ? 0 : -1;
  }

  return {
    width,
    height,
    heightIndex,
    colorIndex: compact.assignment,
    palette: compact.palette,
  };
}

function alphaMask(rgba: Uint8ClampedArray, width: number, height: number): Mask {
  const data = new Uint8Array(width * height);
  for (let i = 0; i < data.length; i++) data[i] = (rgba[i * 4 + 3] ?? 0) > 8 ? 1 : 0;
  return { width, height, data };
}

/** Small bilateral-style filter. It averages texture within a color area
 * while reducing the contribution of pixels across a strong color edge. */
function edgeAwareSmooth(
  rgba: Uint8ClampedArray,
  mask: Mask,
  smoothingStrength: number,
  edgePreservation: number,
): Uint8ClampedArray {
  const strength = Math.min(1, Math.max(0, smoothingStrength));
  if (strength === 0) return rgba.slice();

  const width = mask.width;
  const height = mask.height;
  const radius = 1 + Math.round(strength * 2);
  const passes = strength >= 0.65 ? 2 : 1;
  const colorSigma = 75 - Math.min(1, Math.max(0, edgePreservation)) * 58;
  let source = rgba.slice();

  for (let pass = 0; pass < passes; pass++) {
    const target = source.slice();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (mask.data[i] !== 1) continue;
        const base = i * 4;
        const cr = source[base] ?? 0;
        const cg = source[base + 1] ?? 0;
        const cb = source[base + 2] ?? 0;
        let sumR = 0;
        let sumG = 0;
        let sumB = 0;
        let sumWeight = 0;

        for (let oy = -radius; oy <= radius; oy++) {
          const ny = y + oy;
          if (ny < 0 || ny >= height) continue;
          for (let ox = -radius; ox <= radius; ox++) {
            const nx = x + ox;
            if (nx < 0 || nx >= width) continue;
            const ni = ny * width + nx;
            if (mask.data[ni] !== 1) continue;
            const nb = ni * 4;
            const nr = source[nb] ?? 0;
            const ng = source[nb + 1] ?? 0;
            const blue = source[nb + 2] ?? 0;
            const colorDistance = Math.sqrt((cr - nr) ** 2 + (cg - ng) ** 2 + (cb - blue) ** 2);
            const spatialWeight = 1 / (1 + ox * ox + oy * oy);
            const colorWeight = Math.exp(-(colorDistance * colorDistance) / (2 * colorSigma ** 2));
            const weight = spatialWeight * colorWeight;
            sumR += nr * weight;
            sumG += ng * weight;
            sumB += blue * weight;
            sumWeight += weight;
          }
        }
        target[base] = Math.round(sumR / sumWeight);
        target[base + 1] = Math.round(sumG / sumWeight);
        target[base + 2] = Math.round(sumB / sumWeight);
      }
    }
    source = target;
  }
  return source;
}

function mergeSmallColorRegions(
  input: Int16Array,
  width: number,
  height: number,
  palette: RgbColor[],
  minSizePx: number,
): Int16Array {
  const result = input.slice();
  const labs = palette.map(rgbToLab);

  for (let iteration = 0; iteration < 24; iteration++) {
    const components = findConnectedComponents(result, width, height);
    const small = components
      .filter((component) => component.pixels.length < minSizePx)
      .sort((a, b) => a.pixels.length - b.pixels.length || a.id - b.id);
    if (small.length === 0) break;
    let changed = false;

    for (const component of small) {
      const boundaries = new Map<number, number>();
      for (const i of component.pixels) {
        const x = i % width;
        const y = Math.floor(i / width);
        const neighbors = [
          x > 0 ? i - 1 : -1,
          x + 1 < width ? i + 1 : -1,
          y > 0 ? i - width : -1,
          y + 1 < height ? i + width : -1,
        ];
        for (const neighbor of neighbors) {
          if (neighbor < 0) continue;
          const value = result[neighbor] as number;
          if (value < 0 || value === component.levelValue) continue;
          boundaries.set(value, (boundaries.get(value) ?? 0) + 1);
        }
      }
      if (boundaries.size === 0) continue;

      const sourceLab = labs[component.levelValue];
      let bestValue = component.levelValue;
      let bestScore = -Infinity;
      for (const [value, boundaryLength] of boundaries) {
        const targetLab = labs[value];
        if (!sourceLab || !targetLab) continue;
        const score = boundaryLength / (1 + labDistance(sourceLab, targetLab) / 18);
        if (score > bestScore || (score === bestScore && value < bestValue)) {
          bestScore = score;
          bestValue = value;
        }
      }
      if (bestValue === component.levelValue) continue;
      for (const i of component.pixels) result[i] = bestValue;
      changed = true;
    }
    if (!changed) break;
  }
  return result;
}

function compactPalette(
  input: Int16Array,
  palette: RgbColor[],
): { assignment: Int16Array; palette: RgbColor[] } {
  const used = Array.from(new Set(Array.from(input).filter((value) => value >= 0))).sort(
    (a, b) => a - b,
  );
  const remap = new Map<number, number>();
  used.forEach((oldIndex, newIndex) => remap.set(oldIndex, newIndex));
  const assignment = input.slice();
  for (let i = 0; i < assignment.length; i++) {
    const value = assignment[i] as number;
    if (value >= 0) assignment[i] = remap.get(value) ?? -1;
  }
  return {
    assignment,
    palette: used.flatMap((index) => (palette[index] ? [palette[index]] : [])),
  };
}
