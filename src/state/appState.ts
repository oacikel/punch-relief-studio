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
import {
  DEFAULT_PUNCH_GUIDE_SPACING_CM,
  type PunchGuideSettings,
} from '@/domain/pattern/punchGuide';

export type { PunchGuideMode, PunchGuideSettings } from '@/domain/pattern/punchGuide';

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
  /** As of Iteration 03 Round 1, `orientation`/`view`/`showLabels` below
   * are inert: no UI control writes them anymore (ExportPanel's own view
   * selector, label checkbox, and the app's never-wired orientation
   * toggle were all removed -- export/print now reads Preview's on-screen
   * state directly instead, see ExportPanel.tsx's screenView/
   * screenShowGrid/screenMirrored/screenShowLabels props and
   * docs/DECISIONS.md). Kept here (rather than removed) only because
   * they're still part of `ProjectFile`'s persisted schema and old
   * project JSON round-trips through them -- removing the fields would
   * mean a schema-shape change for no functional gain. Do not add a new
   * UI control that writes these; add the setting to `PatternViewSettings`
   * instead, matching `showOnScreenLabels`/`punchGuide`. */
  orientation: 'front' | 'mirrored';
  view: PatternView;
  showLabels: boolean;
}

/**
 * Iteration 02 Stage C: on-screen Preview pattern display preferences,
 * separate from `ExportSettings`. `showOnScreenLabels` controls the
 * interactive Preview pattern's own C{n}-H{n} labels independently of
 * `ExportSettings.showLabels` (which only ever affected SVG/PNG/print
 * output) -- previously the on-screen pattern had no label toggle at all,
 * it was hardcoded on. `punchGuide` is shared between the on-screen
 * pattern and every export/print path (what you preview is what prints),
 * so it lives here rather than duplicated per surface. See
 * docs/DECISIONS.md for why `punchGuide` is persisted in `ProjectFile`
 * (Stage D needs to reprint it) while `showOnScreenLabels` is not (a pure
 * display preference, not project data -- matching how
 * `ExportSettings.view`/`showLabels` are already AppState-only and never
 * round-tripped through the persisted schema).
 */
export interface PatternViewSettings {
  showOnScreenLabels: boolean;
  punchGuide: PunchGuideSettings;
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
  patternViewSettings: PatternViewSettings;
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
  | { type: 'SET_EXPORT_SETTINGS'; settings: Partial<ExportSettings> }
  | {
      type: 'SET_PATTERN_VIEW_SETTINGS';
      showOnScreenLabels?: boolean;
      punchGuide?: Partial<PunchGuideSettings>;
    };

export const DEFAULT_SINGLE_COLOR: RgbColor = { r: 139, g: 90, b: 60 };

/** Fixed, deterministic fallback palette for newly-created by-height
 * swatches (cycled if more levels than colors) -- chosen for reasonable
 * mutual contrast, not derived from any input data. Sized to 12 entries
 * (not 8) so it covers the full widened height-levels range (2-12, see
 * docs/DECISIONS.md) without two levels defaulting to the identical color
 * before the cycle wraps -- a user can always recolor by hand, but the
 * *default* shouldn't silently repeat within one pattern. */
const DEFAULT_PALETTE: RgbColor[] = [
  { r: 139, g: 90, b: 60 },
  { r: 196, g: 148, b: 92 },
  { r: 90, g: 110, b: 80 },
  { r: 176, g: 82, b: 74 },
  { r: 84, g: 100, b: 130 },
  { r: 210, g: 190, b: 140 },
  { r: 120, g: 70, b: 110 },
  { r: 70, g: 130, b: 120 },
  { r: 60, g: 60, b: 150 },
  { r: 200, g: 150, b: 180 },
  { r: 130, g: 130, b: 60 },
  { r: 90, g: 90, b: 90 },
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
    exportSettings: {
      pageSize: 'a4',
      overlapCm: 1,
      orientation: 'front',
      view: 'combined',
      showLabels: true,
    },
    patternViewSettings: {
      // Preserves the pre-Stage-C behavior exactly (labels were always on,
      // with no toggle) as the default.
      showOnScreenLabels: true,
      punchGuide: { mode: 'none', spacingCm: DEFAULT_PUNCH_GUIDE_SPACING_CM },
    },
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
    case 'SET_PATTERN_VIEW_SETTINGS':
      return {
        ...state,
        patternViewSettings: {
          showOnScreenLabels:
            action.showOnScreenLabels ?? state.patternViewSettings.showOnScreenLabels,
          punchGuide: { ...state.patternViewSettings.punchGuide, ...action.punchGuide },
        },
      };
    default:
      return state;
  }
}
