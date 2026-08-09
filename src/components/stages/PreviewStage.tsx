import { useState } from 'react';
import type { RegionMap } from '@/domain/types';
import type { HeightLevel } from '@/domain/types';
import type { CalibrationProfile } from '@/domain/calibration';
import type { LegendEntry } from '@/domain/pattern/legend';
import type { RenderSettings, PatternDimensions } from '@/state/appState';
import { PatternCanvas } from '@/components/PatternCanvas';
import { SimulationView } from '@/components/SimulationView';
import { Legend } from '@/components/Legend';
import type { PatternView } from '@/export/svgPattern';

interface Props {
  regionMap: RegionMap;
  levels: HeightLevel[];
  legend: LegendEntry[];
  profile: CalibrationProfile;
  dimensions: PatternDimensions;
  renderSettings: RenderSettings;
  onRenderSettingsChange: (patch: Partial<RenderSettings>) => void;
}

const VIEWS: PatternView[] = ['combined', 'color-only', 'height-only', 'contour'];

/** Preview stage: pattern + finished-piece simulation side by side, driven
 * by the same processed region map, per product spec §12. */
export function PreviewStage({
  regionMap,
  levels,
  legend,
  profile,
  dimensions,
  renderSettings,
  onRenderSettingsChange,
}: Props): JSX.Element {
  const [view, setView] = useState<PatternView>('combined');
  const [showGrid, setShowGrid] = useState(false);
  const [mirrored, setMirrored] = useState(false);

  return (
    <section className="stage-panel" aria-labelledby="preview-heading">
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
                onRenderSettingsChange({ pileStyle: e.target.value as RenderSettings['pileStyle'] })
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
    </section>
  );
}
