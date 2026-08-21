import { useState } from 'react';
import type { RegionMap } from '@/domain/types';
import type { HeightLevel } from '@/domain/types';
import type { CalibrationProfile } from '@/domain/calibration';
import type { LegendEntry } from '@/domain/pattern/legend';
import type { RenderSettings, PatternDimensions, ExportSettings } from '@/state/appState';
import { PatternCanvas } from '@/components/PatternCanvas';
import { SimulationView } from '@/components/SimulationView';
import { Legend } from '@/components/Legend';
import { ExportPanel } from '@/components/ExportPanel';
import type { PatternView } from '@/export/svgPattern';
import type { ProjectFile } from '@/domain/projectSchema';

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
  savedProfiles: CalibrationProfile[];
  onCalibrationChange: (profile: CalibrationProfile) => void;
  onCalibrationSave: (profile: CalibrationProfile) => void;
  onCalibrationSelect: (profile: CalibrationProfile) => void;
  onSaveProjectJson: () => void;
  onLoadProjectJson: (project: ProjectFile) => void;
  /** Iteration 02 Stage B: forwarded straight through to `ExportPanel` --
   * see its own doc comment. Set from App.tsx via the Height Levels
   * stage's "Calibrate needle settings" link. */
  focusCalibration?: boolean;
  onCalibrationFocused?: () => void;
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
  savedProfiles,
  onCalibrationChange,
  onCalibrationSave,
  onCalibrationSelect,
  onSaveProjectJson,
  onLoadProjectJson,
  focusCalibration = false,
  onCalibrationFocused = () => {},
}: Props): JSX.Element {
  const [view, setView] = useState<PatternView>('combined');
  const [showGrid, setShowGrid] = useState(false);
  const [mirrored, setMirrored] = useState(false);

  return (
    <section className="stage-panel" aria-labelledby="preview-heading">
      <div className="screen-only">
        <h2 id="preview-heading">Preview the finished piece</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
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
            </label>
            <PatternCanvas
              regionMap={regionMap}
              legend={legend}
              view={view}
              widthCm={dimensions.widthCm}
              heightCm={dimensions.heightCm}
              showGrid={showGrid}
              showLabels
              mirrored={mirrored}
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
            />
          </div>
        </div>

        <h3>Legend</h3>
        <Legend entries={legend} calibrated={profile.calibrated} />
      </div>

      <ExportPanel
        regionMap={regionMap}
        legend={legend}
        dimensions={dimensions}
        onDimensionsChange={onDimensionsChange}
        exportSettings={exportSettings}
        onExportSettingsChange={onExportSettingsChange}
        calibrationProfile={profile}
        savedProfiles={savedProfiles}
        onCalibrationChange={onCalibrationChange}
        onCalibrationSave={onCalibrationSave}
        onCalibrationSelect={onCalibrationSelect}
        onSaveProjectJson={onSaveProjectJson}
        onLoadProjectJson={onLoadProjectJson}
        focusCalibration={focusCalibration}
        onCalibrationFocused={onCalibrationFocused}
      />
    </section>
  );
}
