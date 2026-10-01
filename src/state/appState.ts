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
import { DEFAULT_NEEDLE_GEOMETRY, type NeedleGeometry } from '@/domain/pattern/needleGeometry';
import type { ImageDetailSettings } from '@/domain/image/simplifyImage';

export type { NeedleGeometry } from '@/domain/pattern/needleGeometry';
export type { ImageDetailSettings } from '@/domain/image/simplifyImage';

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

/** Model-straightening rotation, in degrees (docs/ITERATION_03_PLAN.md #5,
 * relocated here from `Viewport3D.tsx`'s local state as part of Iteration
 * 03's combined-workspace change -- see docs/DECISIONS.md). Lifted to
 * `AppState` so two independent components -- `Viewport3D` (Import, and
 * the hidden-but-still-capturing instance shared with Workspace) and the
 * Workspace's own `SimulationPanel` -- can read and write the same value
 * rather than one owning a copy the other can't see. This is a narrower
 * change than it sounds: the lifecycle/persistence semantics are
 * unchanged from the original local-state design -- still per-import
 * (reset to zero on `SET_SOURCE`), still deliberately excluded from
 * `ProjectFile` (straightening is a one-off adjustment for this import
 * session, not a property of the mesh data). */
export interface RotationDeg {
  roll: number;
  pitch: number;
  yaw: number;
}

export const ZERO_ROTATION: RotationDeg = { roll: 0, pitch: 0, yaw: 0 };

export interface ProcessedResult {
  width: number;
  height: number;
  heightIndex: Int16Array;
  colorIndex: Int16Array;
  levels: HeightLevel[];
}

export interface AppState {
  sourceKind: 'none' | 'built-in-sample' | 'user-file' | 'image-file';
  sampleId: string | null;
  sourceFilename: string | null;
  reliefSettings: ReliefSettings;
  colorMode: ColorMode;
  swatches: ColorSwatch[];
  /** Id of the bundled color-story palette (`src/domain/color/palettes.ts`)
   * currently applied to `swatches`, or null if the swatches are either
   * hand-edited or, for an image source, still the raw auto-detected
   * palette. Lets a 2D template's re-simplification (which recomputes the
   * auto-detected palette from scratch on every settings change) keep
   * reapplying the chosen color scheme instead of silently reverting to
   * the auto colors -- see the image-processing success handler in
   * App.tsx. */
  colorStoryId: string | null;
  /** One-level undo for the most recent APPLY_COLOR_STORY: the swatches
   * (and whichever story, if any, was active) immediately before that
   * palette replaced them, so a single "Undo <name>" click can restore
   * exactly that. Cleared by a manual swatch edit, a new import, or a
   * swatch-count resize -- any of which makes restoring this snapshot
   * either meaningless or invalid (see EXP-010, docs/DECISIONS.md). */
  colorStoryUndo: {
    paletteId: string;
    previousSwatches: ColorSwatch[];
    previousColorStoryId: string | null;
  } | null;
  /** The swatch colors as they stood before any color-story palette was
   * ever applied to this import -- captured once, on the first
   * APPLY_COLOR_STORY, so "Reset to default colors" can always return a
   * maker to where they started regardless of how many stories they've
   * tried since. Cleared by a new import or a swatch-count resize. */
  originalSwatches: ColorSwatch[] | null;
  paletteSize: number;
  processed: ProcessedResult | null;
  processing: boolean;
  processingError: string | null;
  calibrationProfile: CalibrationProfile;
  savedProfiles: CalibrationProfile[];
  patternDimensions: PatternDimensions;
  imageDetailSettings: ImageDetailSettings;
  renderSettings: RenderSettings;
  exportSettings: ExportSettings;
  patternViewSettings: PatternViewSettings;
  modelRotationDeg: RotationDeg;
  /** Physical needle inputs: diameter drives the generated width floor;
   * optional length drives only the uncalibrated simulation's relative
   * height range. Both default to 0 (not set). */
  needleGeometry: NeedleGeometry;
}

export type AppAction =
  | { type: 'SET_SOURCE'; sourceKind: AppState['sourceKind']; sampleId?: string; filename?: string }
  | { type: 'SET_RELIEF_SETTINGS'; settings: Partial<ReliefSettings> }
  | { type: 'SET_COLOR_MODE'; mode: ColorMode }
  | { type: 'SET_PALETTE_SIZE'; size: number }
  | { type: 'SET_SWATCHES'; swatches: ColorSwatch[] }
  | { type: 'APPLY_COLOR_STORY'; paletteId: string; swatches: ColorSwatch[] }
  | { type: 'UNDO_COLOR_STORY' }
  | { type: 'RESET_TO_DEFAULT_COLORS' }
  | { type: 'PROCESSING_STARTED' }
  | { type: 'PROCESSING_SUCCEEDED'; result: ProcessedResult }
  | { type: 'PROCESSING_FAILED'; message: string }
  | { type: 'SET_CALIBRATION_PROFILE'; profile: CalibrationProfile }
  | { type: 'SET_SAVED_PROFILES'; profiles: CalibrationProfile[] }
  | { type: 'SET_PATTERN_DIMENSIONS'; dimensions: Partial<PatternDimensions> }
  | { type: 'SET_IMAGE_DETAIL_SETTINGS'; settings: Partial<ImageDetailSettings> }
  | { type: 'SET_RENDER_SETTINGS'; settings: Partial<RenderSettings> }
  | { type: 'SET_EXPORT_SETTINGS'; settings: Partial<ExportSettings> }
  | {
      type: 'SET_PATTERN_VIEW_SETTINGS';
      showOnScreenLabels?: boolean;
      punchGuide?: Partial<PunchGuideSettings>;
    }
  | { type: 'SET_MODEL_ROTATION'; rotation: Partial<RotationDeg> }
  | { type: 'SET_NEEDLE_GEOMETRY'; geometry: Partial<NeedleGeometry> };

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
    colorStoryId: null,
    colorStoryUndo: null,
    originalSwatches: null,
    paletteSize: 4,
    processed: null,
    processing: false,
    processingError: null,
    calibrationProfile: createDefaultProfile(),
    savedProfiles: [],
    patternDimensions: { widthCm: 20, heightCm: 20, lockAspect: true },
    imageDetailSettings: { preserveSmallDetails: true },
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
      view: 'color-only',
      showLabels: true,
    },
    patternViewSettings: {
      // Preserves the pre-Stage-C behavior exactly (labels were always on,
      // with no toggle) as the default.
      showOnScreenLabels: true,
      punchGuide: { mode: 'none', spacingCm: DEFAULT_PUNCH_GUIDE_SPACING_CM },
    },
    modelRotationDeg: { ...ZERO_ROTATION },
    needleGeometry: { ...DEFAULT_NEEDLE_GEOMETRY },
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
        // A newly loaded model always starts unrotated -- straightening is
        // per-import, not a property of the mesh data itself (matches
        // Viewport3D's own former local-state reset-on-new-geometry
        // behavior, now expressed here since the state lives in AppState).
        modelRotationDeg: { ...ZERO_ROTATION },
        // A new import's colors start from its own auto-detected/default
        // palette, not a color story carried over from whatever was
        // loaded before.
        colorStoryId: null,
        colorStoryUndo: null,
        originalSwatches: null,
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
      // A resize invalidates any pending undo/reset snapshot -- restoring a
      // swatch list of the wrong length would break the "one swatch per
      // height level" invariant.
      const resized = swatches !== state.swatches;
      return {
        ...state,
        colorMode: action.mode,
        swatches,
        colorStoryUndo: resized ? null : state.colorStoryUndo,
        originalSwatches: resized ? null : state.originalSwatches,
      };
    }
    case 'SET_PALETTE_SIZE':
      return { ...state, paletteSize: action.size };
    case 'SET_SWATCHES':
      // A direct, hand-made swatch edit (or an auto-detected image palette
      // with no color story chosen) is no longer "the story" -- clears any
      // previously applied colorStoryId so a later re-simplification
      // doesn't stomp on it. APPLY_COLOR_STORY is the action that keeps a
      // story alive across re-simplification.
      // A manual edit also invalidates the pending one-level undo: once the
      // maker has made their own intentional change on top, "Undo <story>"
      // discarding it silently would be surprising rather than helpful.
      return { ...state, swatches: action.swatches, colorStoryId: null, colorStoryUndo: null };
    case 'APPLY_COLOR_STORY':
      return {
        ...state,
        swatches: action.swatches,
        colorStoryId: action.paletteId,
        colorStoryUndo: {
          paletteId: action.paletteId,
          previousSwatches: state.swatches,
          previousColorStoryId: state.colorStoryId,
        },
        // Captured once per import so it always reflects the starting
        // colors, not just the state before the most recent apply.
        originalSwatches: state.originalSwatches ?? state.swatches,
      };
    case 'UNDO_COLOR_STORY': {
      const undo = state.colorStoryUndo;
      if (!undo || undo.previousSwatches.length !== state.swatches.length) return state;
      return {
        ...state,
        swatches: undo.previousSwatches,
        colorStoryId: undo.previousColorStoryId,
        colorStoryUndo: null,
      };
    }
    case 'RESET_TO_DEFAULT_COLORS': {
      const original = state.originalSwatches;
      if (!original || original.length !== state.swatches.length) return state;
      return { ...state, swatches: original, colorStoryId: null, colorStoryUndo: null };
    }
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
      const resized = swatches !== state.swatches;
      return {
        ...state,
        processing: false,
        processed: action.result,
        processingError: null,
        swatches,
        colorStoryUndo: resized ? null : state.colorStoryUndo,
        originalSwatches: resized ? null : state.originalSwatches,
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
    case 'SET_IMAGE_DETAIL_SETTINGS':
      return {
        ...state,
        imageDetailSettings: { ...state.imageDetailSettings, ...action.settings },
      };
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
    case 'SET_MODEL_ROTATION':
      return { ...state, modelRotationDeg: { ...state.modelRotationDeg, ...action.rotation } };
    case 'SET_NEEDLE_GEOMETRY':
      return { ...state, needleGeometry: { ...state.needleGeometry, ...action.geometry } };
    default:
      return state;
  }
}
