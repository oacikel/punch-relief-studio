import { Fragment, useState } from 'react';
import type {
  RegionMap,
  ColorMode,
  ColorSwatch,
  HeightLevel,
  ReliefSettings,
} from '@/domain/types';
import type { CalibrationProfile } from '@/domain/calibration';
import type { LegendEntry } from '@/domain/pattern/legend';
import type {
  RenderSettings,
  PatternDimensions,
  ExportSettings,
  PatternViewSettings,
  PunchGuideSettings,
  RotationDeg,
} from '@/state/appState';
import { ExportPanel } from '@/components/ExportPanel';
import type { PatternView } from '@/export/svgPattern';
import type { ProjectFile } from '@/domain/projectSchema';
import { ReliefControls } from '@/components/workspace/ReliefControls';
import { YarnColorsGroup } from '@/components/workspace/YarnColorsGroup';
import { PatternPanel } from '@/components/workspace/PatternPanel';
import { SimulationPanel } from '@/components/workspace/SimulationPanel';

type PreviewTab = 'pattern' | 'simulation';

interface ProcessedForDisplay {
  levels: HeightLevel[];
  heightIndex: Int16Array;
  width: number;
  height: number;
}

interface Props {
  reliefSettings: ReliefSettings;
  onReliefSettingsChange: (patch: Partial<ReliefSettings>) => void;
  processed: ProcessedForDisplay | null;
  regionMap: RegionMap | null;
  legend: LegendEntry[];
  colorMode: ColorMode;
  swatches: ColorSwatch[];
  paletteSize: number;
  hasSourceColor: boolean;
  onColorModeChange: (mode: ColorMode) => void;
  onSwatchesChange: (swatches: ColorSwatch[]) => void;
  onPaletteSizeChange: (size: number) => void;
  onApplyPalette: (paletteId: string) => void;
  profile: CalibrationProfile;
  dimensions: PatternDimensions;
  onDimensionsChange: (patch: Partial<PatternDimensions>) => void;
  renderSettings: RenderSettings;
  onRenderSettingsChange: (patch: Partial<RenderSettings>) => void;
  exportSettings: ExportSettings;
  onExportSettingsChange: (patch: Partial<ExportSettings>) => void;
  onSaveProjectJson: () => void;
  onLoadProjectJson: (project: ProjectFile) => void;
  patternViewSettings: PatternViewSettings;
  onPatternViewSettingsChange: (patch: {
    showOnScreenLabels?: boolean;
    punchGuide?: Partial<PunchGuideSettings>;
  }) => void;
  rotationDeg: RotationDeg;
  onRotationChange: (patch: Partial<RotationDeg>) => void;
  /** Real in-flight state from `useLiveRelief` (via `AppState.processing`)
   * -- drives the rail heading's live-status pill. */
  processing: boolean;
  processingError: string | null;
}

/**
 * The combined Workspace: a true 50/50 two-column split, both columns
 * capped to the viewport height with their own independent scroll -- a
 * control rail (left, every parameter control plus a collapsed Export &
 * print disclosure at the bottom) and a preview column (right) that shows
 * exactly one of "Pattern" or "Finished-piece simulation" at a time via a
 * tab switch, never both stacked. Modeled on 3D-print slicer software
 * (Cura's Prepare/Preview tabs, PrusaSlicer's persistent 3D view).
 *
 * This is a second redesign of the Workspace, on top of the original
 * combined-workspace build (docs/ITERATION_03_PLAN.md #13) and its
 * usability-fix round -- both shipped and are being reworked again here
 * based on fresh, hands-on product-owner feedback: the previous stacked-
 * panel layout meant "I don't see that there's a live finished-piece
 * simulation without scrolling down, and I wouldn't have scrolled down if
 * I didn't know it already existed there." The tab switch is the direct
 * fix -- the simulation is one click away, never something requiring a
 * scroll to discover. See docs/DECISIONS.md for the full rationale,
 * including why the rail jump-nav, the H1/H2/... coverage chips, the
 * Legend section, and the StageNav sidebar were all removed in the same
 * pass per explicit product-owner decisions.
 *
 * `view`/`showGrid`/`mirrored` live here (not inside `PatternPanel`) as
 * plain `useState`, because `ExportPanel` -- a sibling in the rail, not a
 * child of `PatternPanel` -- needs to read the same on-screen values to
 * keep export/print matching whatever Preview is currently showing (the
 * Iteration 03 Round 1 "no duplicate controls" decision, carried forward
 * unchanged here). `previewTab` is local, uncontrolled state -- purely a
 * display choice, never persisted, never affecting the underlying
 * `regionMap`/`processed` data either tab renders from.
 */
export function Workspace({
  reliefSettings,
  onReliefSettingsChange,
  processed,
  regionMap,
  legend,
  colorMode,
  swatches,
  paletteSize,
  hasSourceColor,
  onColorModeChange,
  onSwatchesChange,
  onPaletteSizeChange,
  onApplyPalette,
  profile,
  dimensions,
  onDimensionsChange,
  renderSettings,
  onRenderSettingsChange,
  exportSettings,
  onExportSettingsChange,
  onSaveProjectJson,
  onLoadProjectJson,
  patternViewSettings,
  onPatternViewSettingsChange,
  rotationDeg,
  onRotationChange,
  processing,
  processingError,
}: Props): JSX.Element {
  const [view, setView] = useState<PatternView>('combined');
  const [showGrid, setShowGrid] = useState(false);
  const [mirrored, setMirrored] = useState(false);
  const [previewTab, setPreviewTab] = useState<PreviewTab>('pattern');
  const { showOnScreenLabels, punchGuide } = patternViewSettings;

  // Written as `regionMap && processed &&` (not a separate boolean) at each
  // use site below so TypeScript's control-flow narrowing actually applies
  // to `regionMap`/`processed` inside each branch, rather than needing a
  // non-null assertion.

  // Two grid-column siblings (matching the existing `.relief-controls-col`
  // / `.relief-preview-col` pattern this reuses, renamed -- see
  // docs/DECISIONS.md), not a nested wrapper -- `main.workspace-layout`
  // (rendered by App.tsx) is the CSS grid parent, and it needs these two
  // divs as direct children for the independent-scroll two-pane mechanism
  // to apply.
  return (
    <Fragment>
      <div className="workspace-controls-col">
        {/* `.screen-only` wraps everything in the rail *except* `ExportPanel`
            (see docs/DECISIONS.md) -- `ExportPanel` renders its own
            `.print-pages` block as a sibling of its `<details>`, which the
            print stylesheet deliberately leaves visible; nesting it inside
            `.screen-only` would hide it too, since a `display:none`
            ancestor can't be overridden by a descendant. `ExportPanel`'s
            own `<details>` is separately hidden in print via the
            `.export-panel` selector in styles.css's `@media print` block,
            same as before this change. */}
        <div className="screen-only">
          <div className="workspace-rail-heading">
            <h2>Workspace</h2>
            <span
              className={
                processing ? 'live-status-pill live-status-pill--processing' : 'live-status-pill'
              }
              aria-live="polite"
            >
              {processing ? '● Processing…' : '● Live — updates as you adjust'}
            </span>
          </div>

          {processingError && (
            <p role="alert" className="warning-banner">
              {processingError}
            </p>
          )}

          <ReliefControls
            settings={reliefSettings}
            onChange={onReliefSettingsChange}
            heightIndex={processed?.heightIndex ?? null}
            width={processed?.width ?? 0}
            height={processed?.height ?? 0}
          />

          <YarnColorsGroup
            mode={colorMode}
            swatches={swatches}
            paletteSize={paletteSize}
            levelCount={processed?.levels.length ?? 0}
            hasSourceColor={hasSourceColor}
            onModeChange={onColorModeChange}
            onSwatchesChange={onSwatchesChange}
            onPaletteSizeChange={onPaletteSizeChange}
            onApplyPalette={onApplyPalette}
          />
        </div>

        {regionMap && processed ? (
          // No controlled `open`/`onOpenChange` passed -- ExportPanel falls
          // back to its own internal `useState` (the rail jump-nav that
          // needed the controlled version to force this open from afar was
          // removed in the same redesign; see docs/DECISIONS.md).
          <ExportPanel
            regionMap={regionMap}
            legend={legend}
            dimensions={dimensions}
            onDimensionsChange={onDimensionsChange}
            exportSettings={exportSettings}
            onExportSettingsChange={onExportSettingsChange}
            onSaveProjectJson={onSaveProjectJson}
            onLoadProjectJson={onLoadProjectJson}
            punchGuide={punchGuide}
            screenView={view}
            screenShowGrid={showGrid}
            screenMirrored={mirrored}
            screenShowLabels={showOnScreenLabels}
          />
        ) : (
          <div className="control-group screen-only" id="rail-export-print">
            <h3>Export &amp; print</h3>
            <p className="helper-text">
              Export &amp; print will be available once the first relief has generated.
            </p>
          </div>
        )}
      </div>

      {/* Entirely screen-only -- no `.print-pages` lives in this column,
          unlike the rail (see the comment above `ExportPanel`). */}
      <div className="workspace-preview-col screen-only">
        {regionMap && processed ? (
          <>
            {/* Tab switch, not stacked panels -- the direct fix for the
                product owner's core complaint (see the component doc
                comment above). Reuses the same `role="group"` +
                `aria-pressed` toggle-button convention `PatternPanel`'s own
                "Pattern view" row already uses elsewhere in this file,
                rather than inventing full ARIA tablist/tab/tabpanel
                semantics this app has no other precedent for. Only one of
                `PatternPanel`/`SimulationPanel` is ever mounted at a time
                (a real conditional render, not CSS-hidden) -- `SimulationView`
                already disposes its renderer/controls/geometry cleanly on
                unmount, so mounting/unmounting it on every tab switch is
                safe, and it sizes its fresh `WebGLRenderer` to whatever
                height this column currently has on each mount. */}
            {/* No `aria-controls` here, deliberately -- only one of the two
                tabpanel divs below is ever mounted at a time (see above),
                so an `aria-controls` value pointing at the currently-
                unmounted one would reference a nonexistent id, which
                axe-core's `aria-valid-attr-value` rule correctly flags as
                a real violation (found via this feature's own e2e
                accessibility sweep). `role="group"` + `aria-pressed`
                already communicates the toggle relationship without it. */}
            <div className="workspace-tabs" role="group" aria-label="Preview mode">
              <button
                type="button"
                aria-pressed={previewTab === 'pattern'}
                onClick={() => setPreviewTab('pattern')}
              >
                Pattern
              </button>
              <button
                type="button"
                aria-pressed={previewTab === 'simulation'}
                onClick={() => setPreviewTab('simulation')}
              >
                Finished-piece simulation
              </button>
            </div>
            {previewTab === 'pattern' ? (
              <div>
                <PatternPanel
                  regionMap={regionMap}
                  legend={legend}
                  widthCm={dimensions.widthCm}
                  heightCm={dimensions.heightCm}
                  view={view}
                  onViewChange={setView}
                  showGrid={showGrid}
                  onShowGridChange={setShowGrid}
                  mirrored={mirrored}
                  onMirroredChange={setMirrored}
                  showOnScreenLabels={showOnScreenLabels}
                  onShowOnScreenLabelsChange={(show) =>
                    onPatternViewSettingsChange({ showOnScreenLabels: show })
                  }
                  punchGuide={punchGuide}
                  onPunchGuideChange={(patch) => onPatternViewSettingsChange({ punchGuide: patch })}
                />
              </div>
            ) : (
              <div>
                <SimulationPanel
                  regionMap={regionMap}
                  levels={processed.levels}
                  profile={profile}
                  widthCm={dimensions.widthCm}
                  heightCm={dimensions.heightCm}
                  renderSettings={renderSettings}
                  onRenderSettingsChange={onRenderSettingsChange}
                  legend={legend}
                  rotationDeg={rotationDeg}
                  onRotationChange={onRotationChange}
                />
              </div>
            )}
          </>
        ) : (
          <div className="workspace-panel" aria-live="polite">
            <p className="helper-text">Generating your first relief…</p>
          </div>
        )}
      </div>
    </Fragment>
  );
}
