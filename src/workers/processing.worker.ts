/**
 * Web Worker entry point: runs the full height pipeline (mask -> normalize
 * -> invert -> intensity -> smooth -> quantize -> cleanup) and, when
 * requested, color quantization, off the main thread so the UI stays
 * responsive during processing (per docs/PLAN.md milestone 4/6 resolution).
 * Contains no logic of its own -- purely wires src/domain functions to
 * postMessage, so the actual algorithms stay unit-testable without a
 * worker context.
 */
/// <reference lib="webworker" />
import { quantizeColors } from '@/domain/color/colorQuantize';
import {
  applyIntensity,
  buildForegroundMask,
  invertRelief,
  normalizeDepth,
  smoothRelief,
} from '@/domain/relief';
import { cleanupTinyRegions, applyNeedleWidthOpening } from '@/domain/regionCleanup';
import { computeLevelBounds, quantize } from '@/domain/quantize';
import { minRegionPxForPreset } from '@/domain/pattern/minRegionPreset';
import { isNeedleGeometrySet, minWidthPxForLevel } from '@/domain/pattern/needleGeometry';
import type { NeedleGeometry } from '@/domain/pattern/needleGeometry';
import type { ReliefSettings } from '@/domain/types';

export interface ProcessRequest {
  type: 'process';
  requestId: string;
  depth: Float32Array;
  width: number;
  height: number;
  emptyValue: number;
  settings: ReliefSettings;
  /** Needle-geometry width floor inputs (docs/ITERATION_04_PLAN.md) --
   * `needleGeometry` defaults to "unset" (0,0), which disables the
   * constraint; `patternDimensions` supplies the physical scale needed to
   * convert `needleGeometry`'s mm values into raster pixels. */
  needleGeometry: NeedleGeometry;
  patternDimensions: { widthCm: number; heightCm: number };
  color?: { data: Uint8ClampedArray; channels: 3 | 4; paletteSize: number; seed: number };
}

export interface ProcessResponse {
  type: 'processed';
  requestId: string;
  heightIndex: Int16Array;
  levels: ReturnType<typeof computeLevelBounds>;
  colorIndex?: Int16Array;
  palette?: { r: number; g: number; b: number }[];
}

export interface ProcessErrorResponse {
  type: 'error';
  requestId: string;
  message: string;
}

self.onmessage = (event: MessageEvent<ProcessRequest>) => {
  const msg = event.data;
  if (msg.type !== 'process') return;
  try {
    const mask = buildForegroundMask(msg.depth, msg.width, msg.height, msg.emptyValue);
    let field = normalizeDepth(msg.depth, mask);
    field = invertRelief(field, msg.settings.invert);
    field = applyIntensity(field, mask, msg.settings.intensity);
    field = smoothRelief(
      field,
      mask,
      msg.settings.smoothingStrength,
      msg.settings.edgePreservation,
    );

    const levels = computeLevelBounds(
      msg.settings.levels,
      msg.settings.quantizationMode,
      field,
      mask,
    );
    const { heightIndex } = quantize(field, mask, levels);
    const minRegionPx = minRegionPxForPreset(msg.settings.minRegionPreset, msg.width, msg.height);
    const cleanedFlat = cleanupTinyRegions(heightIndex, msg.width, msg.height, minRegionPx);

    // Needle-diameter-driven width floor, per pile-height level -- a local-
    // thickness (morphological opening) check, not merely a whole-region
    // area check, so a region with plenty of total area but a thin neck or
    // spike still gets that thin part absorbed into a neighboring region
    // (see docs/DECISIONS.md's "Needle-width floor: from area check to
    // local-thickness opening"). Shapes heightIndex directly, not a
    // warning (docs/ITERATION_04_PLAN.md §3); runs after (not instead of)
    // the flat preset-based cleanup above -- the two are independent
    // floors. colorIndex below deliberately keeps the flat, preset-only
    // threshold: pile height/loop height has no meaning for a color
    // region.
    const cleaned = isNeedleGeometrySet(msg.needleGeometry)
      ? applyNeedleWidthOpening(cleanedFlat, msg.width, msg.height, (levelValue) => {
          const widthPx = minWidthPxForLevel(
            levelValue,
            levels.length,
            msg.needleGeometry,
            msg.patternDimensions.widthCm,
            msg.patternDimensions.heightCm,
            msg.width,
            msg.height,
          );
          return Math.round(widthPx / 2);
        })
      : cleanedFlat;

    let colorIndex: Int16Array | undefined;
    let palette: { r: number; g: number; b: number }[] | undefined;
    if (msg.color) {
      const result = quantizeColors(
        msg.color.data,
        msg.color.channels,
        mask,
        msg.color.paletteSize,
        msg.color.seed,
      );
      colorIndex = cleanupTinyRegions(result.assignment, msg.width, msg.height, minRegionPx);
      palette = result.palette;
    }

    const response: ProcessResponse = {
      type: 'processed',
      requestId: msg.requestId,
      heightIndex: cleaned,
      levels,
      // exactOptionalPropertyTypes forbids assigning `T | undefined` to an
      // optional key -- spread conditionally so the key is omitted entirely
      // rather than set to `undefined`.
      ...(colorIndex !== undefined ? { colorIndex } : {}),
      ...(palette !== undefined ? { palette } : {}),
    };
    (self as unknown as Worker).postMessage(response, [cleaned.buffer]);
  } catch (err) {
    const response: ProcessErrorResponse = {
      type: 'error',
      requestId: msg.requestId,
      message: err instanceof Error ? err.message : String(err),
    };
    (self as unknown as Worker).postMessage(response);
  }
};

export {};
