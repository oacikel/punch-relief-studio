import type { CalibrationProfile } from '@/domain/calibration';
import type { LegendEntry } from '@/domain/pattern/legend';
import type { HeightLevel, RegionMap } from '@/domain/types';
import type { RenderSettings, RotationDeg } from '@/state/appState';
import { SimulationView } from '@/components/SimulationView';
import { RotationControls } from '@/components/RotationControls';

interface Props {
  regionMap: RegionMap;
  levels: HeightLevel[];
  profile: CalibrationProfile;
  widthCm: number;
  heightCm: number;
  renderSettings: RenderSettings;
  onRenderSettingsChange: (patch: Partial<RenderSettings>) => void;
  legend: LegendEntry[];
  rotationDeg: RotationDeg;
  onRotationChange: (patch: Partial<RotationDeg>) => void;
}

/**
 * "Finished-piece simulation" panel -- the former Preview stage's
 * simulation column (pile-style selector, lighting-direction slider, the
 * 3D render), plus the model-straightening rotation controls the product
 * owner specifically asked to have here rather than only on the separate
 * Import step (Iteration 03's combined-workspace change --
 * docs/ITERATION_03_PLAN.md #13). The rotation controls write to the same
 * `AppState.modelRotationDeg` value Import's own `Viewport3D` reads/writes
 * -- see docs/DECISIONS.md for why rotation was lifted out of
 * `Viewport3D`'s local state to make this possible while keeping
 * `SimulationView`'s actual yarn-colored render (not a raw-model view) as
 * what's shown here.
 */
export function SimulationPanel({
  regionMap,
  levels,
  profile,
  widthCm,
  heightCm,
  renderSettings,
  onRenderSettingsChange,
  legend,
  rotationDeg,
  onRotationChange,
}: Props): JSX.Element {
  return (
    <div className="workspace-panel">
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
          onChange={(e) => onRenderSettingsChange({ lightingAzimuthDeg: Number(e.target.value) })}
        />
      </div>
      <SimulationView
        regionMap={regionMap}
        levels={levels}
        profile={profile}
        widthCm={widthCm}
        heightCm={heightCm}
        renderSettings={renderSettings}
        legend={legend}
      />
      <RotationControls
        rotationDeg={rotationDeg}
        onAxisChange={(axis, value) => onRotationChange({ [axis]: value })}
        onReset={() => onRotationChange({ roll: 0, pitch: 0, yaw: 0 })}
        idPrefix="sim"
        helperText="Straighten the model to change what the relief captures -- this affects the actual pattern, not just this preview."
      />
    </div>
  );
}
