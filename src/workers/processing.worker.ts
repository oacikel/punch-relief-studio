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
import { cleanupTinyRegions } from '@/domain/regionCleanup';
import { computeLevelBounds, quantize } from '@/domain/quantize';
import type { ReliefSettings } from '@/domain/types';

export interface ProcessRequest {
  type: 'process';
  requestId: string;
  depth: Float32Array;
  width: number;
  height: number;
  emptyValue: number;
  settings: ReliefSettings;
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
    field = smoothRelief(field, mask, msg.settings.smoothingStrength, msg.settings.edgePreservation);

    const levels = computeLevelBounds(msg.settings.levels, msg.settings.quantizationMode, field, mask);
    const { heightIndex } = quantize(field, mask, levels);
    const cleaned = cleanupTinyRegions(heightIndex, msg.width, msg.height, msg.settings.minRegionPx);

    let colorIndex: Int16Array | undefined;
    let palette: { r: number; g: number; b: number }[] | undefined;
    if (msg.color) {
      const result = quantizeColors(msg.color.data, msg.color.channels, mask, msg.color.paletteSize, msg.color.seed);
      colorIndex = cleanupTinyRegions(result.assignment, msg.width, msg.height, msg.settings.minRegionPx);
      palette = result.palette;
    }

    const response: ProcessResponse = {
      type: 'processed',
      requestId: msg.requestId,
      heightIndex: cleaned,
      levels,
      colorIndex,
      palette,
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
