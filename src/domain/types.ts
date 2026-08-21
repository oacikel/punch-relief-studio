/**
 * Shared domain types. Centralized here (rather than re-declared per
 * module) so that cross-module contracts can only drift in one place --
 * see docs/PLAN_REVIEW.md, "zero-compile risk" resolution.
 */
import type { NormalizedDepth, Px } from './units';

/** A single-channel raster field: width*height values, row-major. */
export interface ScalarField {
  width: number;
  height: number;
  data: Float32Array; // length === width * height
}

/** Boolean foreground mask, same layout as ScalarField. */
export interface Mask {
  width: number;
  height: number;
  data: Uint8Array; // 1 = foreground, 0 = background, length === width*height
}

export interface RgbColor {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
}

export type ColorMode = 'single' | 'by-height' | 'source-material';

export interface HeightLevel {
  /** 0-based index, 0 = lowest pile. */
  index: number;
  /** Inclusive lower bound of normalized depth mapped to this level. */
  lowerBound: NormalizedDepth;
  /** Exclusive upper bound (1.0 for the top level). */
  upperBound: NormalizedDepth;
}

export type QuantizationMode = 'equal-interval' | 'quantile';

/** Per-pixel assignment: which height level and which color index. */
export interface RegionMap {
  width: number;
  height: number;
  /** Height level index per pixel, -1 = background. */
  heightIndex: Int16Array;
  /** Color index per pixel, -1 = background or not yet assigned. */
  colorIndex: Int16Array;
}

export interface ColorSwatch {
  index: number;
  color: RgbColor;
  yarnName: string;
}

export interface ReliefSettings {
  outputResolutionPx: Px;
  levels: number; // 2-12
  intensity: number; // 0-1, scales relief depth before quantization
  invert: boolean; // near-to-high (false) vs near-to-low (true)
  smoothingStrength: number; // 0-1
  edgePreservation: number; // 0-1, 0 = pure gaussian, 1 = bilateral-like
  minRegionPx: number; // connected-component cleanup threshold
  quantizationMode: QuantizationMode;
  seed: number;
}

export const DEFAULT_RELIEF_SETTINGS: ReliefSettings = {
  outputResolutionPx: 256 as Px,
  levels: 4,
  intensity: 1,
  invert: false,
  smoothingStrength: 0.3,
  edgePreservation: 0.5,
  minRegionPx: 12,
  quantizationMode: 'equal-interval',
  seed: 0x50554e43,
};
