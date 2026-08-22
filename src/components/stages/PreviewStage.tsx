import { useState } from 'react';
import type { RegionMap } from '@/domain/types';
import type { HeightLevel } from '@/domain/types';
import type { CalibrationProfile } from '@/domain/calibration';
import type { LegendEntry } from '@/domain/pattern/legend';
import type {
  RenderSettings,
  PatternDimensions,
  ExportSettings,
  PatternViewSettings,
  PunchGuideSettings,
} from '@/state/appState';
import { PatternCanvas } from '@/components/PatternCanvas';
import { SimulationView } from '@/components/SimulationView';
import { Legend } from '@/components/Legend';
import { ExportPanel } from '@/components/ExportPanel';
import type { PatternView } from '@/export/svgPattern';
import type { ProjectFile } from '@/domain/projectSchema';
import {
  MIN_PUNCH_GUIDE_SPACING_CM,
  MAX_PUNCH_GUIDE_SPACING_CM,
  clampPunchGuideSpacingCm,
  type PunchGuideMode,
} from '@/domain/pattern/punchGuide';

interface Props {
  regionMap: RegionMap;
  levels: HeightLevel[];
  legend: LegendEntry[];
  profile: CalibrationProfile;
  dimensions: PatternDimensions;
  onDimensionsChange: (patch: Partial<PatternDimensions>) => void;
  renderSettings: RenderSettings;
  onRenderSettingsChange: (patch: Partial<RenderSettings>) => void;
  exportSettings: ExportSettings;
  onExportSettingsChange: (patch: Partial<ExportSettings>) => void;
  onSaveProjectJson: () => void;
  onLoadProjectJson: (project: ProjectFile) => void;
  /** Iteration 02 Stage C: on-screen label toggle + punch-guide selector
   * state, shared with the export/print panel below (see
   * docs/DECISIONS.md). */
  patternViewSettings: PatternViewSettings;
  onPatternViewSettingsChange: (patch: {
    showOnScreenLabels?: boolean;
    punchGuide?: Partial<PunchGuideSettings>;
  }) => void;
}

const VIEWS: PatternView[] = ['combined', 'color-only', 'height-only', 'contour'];

/**
 * Preview stage: pattern + finished-piece simulation side by side, driven
 * by the same processed region map, per product spec §12.
 *
 * As of Iteration 02 Stage A, this stage also hosts every export/print/
 * calibration action (formerly a separate "Export" workflow stage -- see
 * docs/ITERATION_02_PLAN.md) via the compact `ExportPanel` disclosure below.
 * All of the stage's normal on-screen content is wrapped in `.screen-only`,
 * which `@media print` in styles.css now hides -- Export and Preview used
 * to be mutually exclusive stages, so print only ever had to hide Export's
 * own controls; now that both live on one page, Preview's pattern/
 * simulation/legend content would otherwise print alongside (or instead of)
 * the intended `.print-pages` output. See ITERATION_02_PLAN.md §7/§7.1 for
 * why this wrapper exists.
 */
export function PreviewStage({
  regionMap,
  levels,
  legend,
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
}: Props): JSX.Element {
  const [view, setView] = useState<PatternView>('combined');
  const [showGrid, setShowGrid] = useState(false);
  const [mirrored, setMirrored] = useState(false);
  const { showOnScreenLabels, punchGuide } = patternViewSettings;

  return (
    <section className="stage-panel" aria-labelledby="preview-heading">
      <div className="screen-only">
        <h2 id="preview-heading">Preview the finished piece</h2>

        <div className="preview-columns">
          <div>
            <h3>Pattern</h3>
            <div role="group" aria-label="Pattern view" style={{ marginBottom: 8 }}>
              {VIEWS.map((v) => (
                <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>
                  {v}
                </button>
              ))}
            </div>
            <label>
              <input
                type="checkbox"
                checked={showGrid}
                onChange={(e) => setShowGrid(e.target.checked)}
              />{' '}
              Grid
            </label>{' '}
            <label>
              <input
                type="checkbox"
                checked={mirrored}
                onChange={(e) => setMirrored(e.target.checked)}
              />{' '}
              Mirrored (back side)
            </label>{' '}
            <label>
              <input
                type="checkbox"
                checked={showOnScreenLabels}
                onChange={(e) =>
                  onPatternViewSettingsChange({ showOnScreenLabels: e.target.checked })
                }
              />{' '}
              Region labels (C1-H1 etc.)
            </label>
            <div className="field" style={{ marginTop: 8 }}>
              <label htmlFor="punch-guide-mode">Punch guide</label>
              <select
                id="punch-guide-mode"
                value={punchGuide.mode}
                onChange={(e) =>
                  onPatternViewSettingsChange({
                    punchGuide: { mode: e.target.value as PunchGuideMode },
                  })
                }
              >
                <option value="none">None</option>
                <option value="dots">Dots</option>
              </select>
            </div>
            {punchGuide.mode === 'dots' && (
              <div className="field">
                <label htmlFor="punch-guide-spacing">Dot spacing (cm)</label>
                <input
                  id="punch-guide-spacing"
                  type="number"
                  min={MIN_PUNCH_GUIDE_SPACING_CM}
                  max={MAX_PUNCH_GUIDE_SPACING_CM}
                  step={0.1}
                  value={punchGuide.spacingCm}
                  onChange={(e) =>
                    onPatternViewSettingsChange({
                      punchGuide: { spacingCm: clampPunchGuideSpacingCm(Number(e.target.value)) },
                    })
                  }
                />
              </div>
            )}
            <p className="helper-text">
              Adds evenly spaced dots across the pattern as a rough placement guide. This is the
              spacing you set here, not a measurement of your printer&apos;s actual output -- always
              check the printed scale-check square with a ruler before punching.
            </p>
            <PatternCanvas
              regionMap={regionMap}
              legend={legend}
              view={view}
              widthCm={dimensions.widthCm}
              heightCm={dimensions.heightCm}
              showGrid={showGrid}
              showLabels={showOnScreenLabels}
              mirrored={mirrored}
              punchGuide={punchGuide}
            />
          </div>
          <div>
            <h3>Finished-piece simulation</h3>
            <div className="field">
              <label htmlFor="pile-style">Pile style</label>
              <select
                id="pile-style"
                value={renderSettings.pileStyle}
                onChange={(e) =>
                  onRenderSettingsChange({
                    pileStyle: e.target.value as RenderSettings['pileStyle'],
                  })
                }
              >
                <option value="loop">Loop pile</option>
                <option value="cut">Cut pile</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="lighting-az">Lighting direction</label>
              <input
                id="lighting-az"
                type="range"
                min={0}
                max={360}
                value={renderSettings.lightingAzimuthDeg}
                onChange={(e) =>
                  onRenderSettingsChange({ lightingAzimuthDeg: Number(e.target.value) })
                }
              />
            </div>
            <SimulationView
              regionMap={regionMap}
              levels={levels}
              profile={profile}
              widthCm={dimensions.widthCm}
              heightCm={dimensions.heightCm}
              renderSettings={renderSettings}
              legend={legend}
            />
          </div>
        </div>

        <h3>Legend</h3>
        <Legend entries={legend} />
      </div>

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
    </section>
  );
}
