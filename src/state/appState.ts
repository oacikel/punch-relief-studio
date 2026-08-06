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
    exportSettings: { pageSize: 'a4', overlapCm: 1, orientation: 'front' },
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
    case 'SET_COLOR_MODE':
      return { ...state, colorMode: action.mode };
    case 'SET_PALETTE_SIZE':
      return { ...state, paletteSize: action.size };
    case 'SET_SWATCHES':
      return { ...state, swatches: action.swatches };
    case 'PROCESSING_STARTED':
      return { ...state, processing: true, processingError: null };
    case 'PROCESSING_SUCCEEDED':
      return { ...state, processing: false, processed: action.result, processingError: null };
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
