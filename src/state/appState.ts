/**
 * Central domain state for the app: everything that isn't purely workflow
 * navigation (see state/workflow.ts). One reducer so every stage reads and
 * writes through the same, testable transitions instead of scattered
 * useState calls that could drift out of sync.
 */
import { createDefaultProfile, type CalibrationProfile } from '@/domain/calibration';
import { DEFAULT_RELIEF_SETTINGS } from '@/domain/types';
import type { ColorMode, ColorSwatch, HeightLevel, ReliefSettings, RgbColor } from '@/domain/types';
import type { PageSize } from '@/export/printTiling';
import type { PatternView } from '@/export/svgPattern';

export interface PatternDimensions {
  widthCm: number;
  heightCm: number;
  lockAspect: boolean;
}

export interface RenderSettings {
  pileStyle: 'loop' | 'cut';
  density: number;
  yarnThickness: number;
  fabricColorHex: string;
  lightingAzimuthDeg: number;
  lightingElevationDeg: number;
}

export interface ExportSettings {
  pageSize: PageSize;
  overlapCm: number;
  orientation: 'front' | 'mirrored';
  /** Which pattern view (combined/color-only/height-only/contour) gets
   * used for SVG/PNG/print export -- previously every export path was
   * hardcoded to 'combined' regardless of what the user might want. */
  view: PatternView;
}

export interface ProcessedResult {
  width: number;
  height: number;
  heightIndex: Int16Array;
  colorIndex: Int16Array;
  levels: HeightLevel[];
}

export interface AppState {
  sourceKind: 'none' | 'built-in-sample' | 'user-file';
  sampleId: string | null;
  sourceFilename: string | null;
  reliefSettings: ReliefSettings;
  colorMode: ColorMode;
  swatches: ColorSwatch[];
  paletteSize: number;
  processed: ProcessedResult | null;
  processing: boolean;
  processingError: string | null;
  calibrationProfile: CalibrationProfile;
  savedProfiles: CalibrationProfile[];
  patternDimensions: PatternDimensions;
  renderSettings: RenderSettings;
  exportSettings: ExportSettings;
}

export type AppAction =
  | { type: 'SET_SOURCE'; sourceKind: AppState['sourceKind']; sampleId?: string; filename?: string }
  | { type: 'SET_RELIEF_SETTINGS'; settings: Partial<ReliefSettings> }
  | { type: 'SET_COLOR_MODE'; mode: ColorMode }
  | { type: 'SET_PALETTE_SIZE'; size: number }
  | { type: 'SET_SWATCHES'; swatches: ColorSwatch[] }
  | { type: 'PROCESSING_STARTED' }
  | { type: 'PROCESSING_SUCCEEDED'; result: ProcessedResult }
  | { type: 'PROCESSING_FAILED'; message: string }
  | { type: 'SET_CALIBRATION_PROFILE'; profile: CalibrationProfile }
  | { type: 'SET_SAVED_PROFILES'; profiles: CalibrationProfile[] }
  | { type: 'SET_PATTERN_DIMENSIONS'; dimensions: Partial<PatternDimensions> }
  | { type: 'SET_RENDER_SETTINGS'; settings: Partial<RenderSettings> }
  | { type: 'SET_EXPORT_SETTINGS'; settings: Partial<ExportSettings> };

export const DEFAULT_SINGLE_COLOR: RgbColor = { r: 139, g: 90, b: 60 };

/** Fixed, deterministic fallback palette for newly-created by-height
 * swatches (cycled if more levels than colors) -- chosen for reasonable
 * mutual contrast, not derived from any input data. */
const DEFAULT_PALETTE: RgbColor[] = [
  { r: 139, g: 90, b: 60 },
  { r: 196, g: 148, b: 92 },
  { r: 90, g: 110, b: 80 },
  { r: 176, g: 82, b: 74 },
  { r: 84, g: 100, b: 130 },
  { r: 210, g: 190, b: 140 },
  { r: 120, g: 70, b: 110 },
  { r: 70, g: 130, b: 120 },
];

function defaultColorForIndex(index: number): RgbColor {
  return DEFAULT_PALETTE[index % DEFAULT_PALETTE.length] ?? DEFAULT_SINGLE_COLOR;
}

/**
 * Pad or truncate a swatch list to exactly `count` entries, preserving
 * existing color/name choices by index and filling any new slots with a
 * deterministic default. Used to keep "color by height" mode's swatch
 * count in sync with the generated height-level count -- without this,
 * assignColorByHeight() throws when the counts drift apart (see
 * docs/PLAN_REVIEW.md-equivalent implementation review finding).
 */
export function resizeSwatches(swatches: ColorSwatch[], count: number): ColorSwatch[] {
  if (swatches.length === count) return swatches;
  const next: ColorSwatch[] = [];
  for (let i = 0; i < count; i++) {
    const existing = swatches[i];
    next.push(
      existing
        ? { ...existing, index: i }
        : { index: i, color: defaultColorForIndex(i), yarnName: `Yarn ${i + 1}` },
    );
  }
  return next;
}

export function initialAppState(): AppState {
  return {
    sourceKind: 'none',
    sampleId: null,
    sourceFilename: null,
    reliefSettings: { ...DEFAULT_RELIEF_SETTINGS },
    colorMode: 'single',
    swatches: [{ index: 0, color: DEFAULT_SINGLE_COLOR, yarnName: 'Yarn 1' }],
    paletteSize: 4,
    processed: null,
    processing: false,
    processingError: null,
    calibrationProfile: createDefaultProfile(),
    savedProfiles: [],
    patternDimensions: { widthCm: 20, heightCm: 20, lockAspect: true },
    renderSettings: {
      pileStyle: 'loop',
      density: 0.6,
      yarnThickness: 0.5,
      fabricColorHex: '#e8ddc8',
      lightingAzimuthDeg: 45,
      lightingElevationDeg: 55,
    },
    exportSettings: { pageSize: 'a4', overlapCm: 1, orientation: 'front', view: 'combined' },
  };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_SOURCE':
      return {
        ...state,
        sourceKind: action.sourceKind,
        sampleId: action.sampleId ?? null,
        sourceFilename: action.filename ?? null,
        processed: null,
        processingError: null,
      };
    case 'SET_RELIEF_SETTINGS':
      return { ...state, reliefSettings: { ...state.reliefSettings, ...action.settings } };
    case 'SET_COLOR_MODE': {
      // Switching into "by-height" must keep exactly one swatch per height
      // level, or assignColorByHeight() throws -- resize here so the
      // invariant holds regardless of which stage the user came from.
      const swatches =
        action.mode === 'by-height' && state.processed
          ? resizeSwatches(state.swatches, state.processed.levels.length)
          : state.swatches;
      return { ...state, colorMode: action.mode, swatches };
    }
    case 'SET_PALETTE_SIZE':
      return { ...state, paletteSize: action.size };
    case 'SET_SWATCHES':
      return { ...state, swatches: action.swatches };
    case 'PROCESSING_STARTED':
      return { ...state, processing: true, processingError: null };
    case 'PROCESSING_SUCCEEDED': {
      // Re-generating the relief can change the level count -- keep
      // by-height swatches in sync with it immediately, not just on the
      // next explicit mode change.
      const swatches =
        state.colorMode === 'by-height'
          ? resizeSwatches(state.swatches, action.result.levels.length)
          : state.swatches;
      return {
        ...state,
        processing: false,
        processed: action.result,
        processingError: null,
        swatches,
      };
    }
    case 'PROCESSING_FAILED':
      return { ...state, processing: false, processingError: action.message };
    case 'SET_CALIBRATION_PROFILE':
      return { ...state, calibrationProfile: action.profile };
    case 'SET_SAVED_PROFILES':
      return { ...state, savedProfiles: action.profiles };
    case 'SET_PATTERN_DIMENSIONS':
      return { ...state, patternDimensions: { ...state.patternDimensions, ...action.dimensions } };
    case 'SET_RENDER_SETTINGS':
      return { ...state, renderSettings: { ...state.renderSettings, ...action.settings } };
    case 'SET_EXPORT_SETTINGS':
      return { ...state, exportSettings: { ...state.exportSettings, ...action.settings } };
    default:
      return state;
  }
}
