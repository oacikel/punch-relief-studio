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
import { Legend } from '@/components/Legend';
import { ExportPanel } from '@/components/ExportPanel';
import type { PatternView } from '@/export/svgPattern';
import type { ProjectFile } from '@/domain/projectSchema';
import { ReliefControls } from '@/components/workspace/ReliefControls';
import { YarnColorsGroup } from '@/components/workspace/YarnColorsGroup';
import { PatternPanel } from '@/components/workspace/PatternPanel';
import { SimulationPanel } from '@/components/workspace/SimulationPanel';

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
 * The combined Workspace: a persistent control rail (left) alongside a
 * sticky, always-visible preview column (right) with two stacked panels --
 * modeled on 3D-print slicer software (Cura, PrusaSlicer), replacing the
 * former Create relief / Height levels / Yarn colors / Preview wizard
 * stages (Iteration 03's combined-workspace change -- see
 * docs/ITERATION_03_PLAN.md #13 and docs/DECISIONS.md for the full
 * rationale and the two architectural wrinkles this resolves).
 *
 * `view`/`showGrid`/`mirrored` live here (not inside `PatternPanel`) as
 * plain `useState`, because `ExportPanel` -- a sibling in the rail, not a
 * child of `PatternPanel` -- needs to read the same on-screen values to
 * keep export/print matching whatever Preview is currently showing (the
 * Iteration 03 Round 1 "no duplicate controls" decision, carried forward
 * unchanged here).
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
  // Usability fix #4 (docs/DECISIONS.md): lifted out of ExportPanel so the
  // jump-nav below can force the disclosure open from afar, not just
  // toggle it in place.
  const [exportOpen, setExportOpen] = useState(false);
  const { showOnScreenLabels, punchGuide } = patternViewSettings;

  // Usability fix #3/#4: scrolls a rail section's heading to the top of
  // the viewport. Plain `document.getElementById` rather than a ref map,
  // since these ids are stable, unique DOM anchors the rail already needs
  // for the sticky-mini-header CSS (`.rail-section`) -- no extra plumbing
  // to wire a ref through each child component just for this.
  const jumpTo = (id: string): void => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Written as `regionMap && processed &&` (not a separate boolean) at each
  // use site below so TypeScript's control-flow narrowing actually applies
  // to `regionMap`/`processed` inside each branch, rather than needing a
  // non-null assertion.

  // Two grid-column siblings (matching the existing `.relief-controls-col`
  // / `.relief-preview-col` pattern this reuses, renamed -- see
  // docs/DECISIONS.md), not a nested wrapper -- `main.workspace-layout`
  // (rendered by App.tsx) is the CSS grid parent, and it needs these two
  // divs as direct children for the sticky-preview mechanism to apply.
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

          {/* Usability fix #3/#4 (docs/DECISIONS.md): a short jump-nav so
              a section further down a long, fast-growing rail is never
              more than one click away -- and, for "Export & print"
              specifically, a persistent affordance so it's reachable
              without a long scroll past every color swatch, since it's
              otherwise the last, easy-to-forget thing in the rail. */}
          <nav className="rail-jump-nav" aria-label="Jump to rail section">
            <button type="button" onClick={() => jumpTo('rail-needle-pile')}>
              Needle &amp; pile
            </button>
            <button type="button" onClick={() => jumpTo('rail-punch-detail')}>
              Punch detail
            </button>
            <button type="button" onClick={() => jumpTo('rail-shape-interpretation')}>
              Shape interpretation
            </button>
            <button type="button" onClick={() => jumpTo('rail-yarn-colors')}>
              Yarn colors
            </button>
            <button
              type="button"
              onClick={() => {
                setExportOpen(true);
                jumpTo('rail-export-print');
              }}
            >
              Export &amp; print
            </button>
          </nav>

          {processingError && (
            <p role="alert" className="warning-banner">
              {processingError}
            </p>
          )}

          <ReliefControls
            settings={reliefSettings}
            onChange={onReliefSettingsChange}
            levels={processed?.levels ?? null}
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
            open={exportOpen}
            onOpenChange={setExportOpen}
          />
        ) : (
          // Same id as the real ExportPanel's <details> above -- the
          // jump-nav's Export & print button needs a valid scroll target
          // even before the first relief has generated.
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
            <div className="workspace-panel">
              <h3>Legend</h3>
              <Legend entries={legend} />
            </div>
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
