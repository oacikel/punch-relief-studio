import { useMemo } from 'react';
import type { ReliefSettings } from '@/domain/types';
import { findSmallRegions } from '@/domain/regionCleanup';
import {
  MIN_REGION_PRESET_ORDER,
  MIN_REGION_PRESET_LABELS,
  MIN_REGION_PRESET_DESCRIPTIONS,
  minRegionPxForPreset,
  type MinRegionPreset,
} from '@/domain/pattern/minRegionPreset';
import { DecimalNumberInput } from '@/components/DecimalNumberInput';
import type { NeedleGeometry } from '@/state/appState';

interface Props {
  settings: ReliefSettings;
  onChange: (patch: Partial<ReliefSettings>) => void;
  heightIndex: Int16Array | null;
  width: number;
  height: number;
  /** Needle diameter/throw, direct mm input (docs/ITERATION_04_PLAN.md) --
   * drives the needle-geometry width floor that shapes the pattern during
   * generation. `{diameterMm: 0, throwMm: 0}` (the default) means "not
   * set," which disables the constraint entirely. */
  needleGeometry: NeedleGeometry;
  onNeedleGeometryChange: (patch: Partial<NeedleGeometry>) => void;
}

/**
 * "Needle & pile" / "Punch detail" / "Shape interpretation" control groups
 * -- the former `ReliefStage.tsx` content verbatim, now rendered inline in
 * the Workspace rail instead of on its own page, with the manual "Generate
 * relief" button removed (live regeneration replaces it -- see
 * `src/hooks/useLiveRelief.ts`). The small-region warning (folded in from
 * the former `HeightStage.tsx`) lives under "Punch detail", directly under
 * the min-region preset that drives it -- keeping cause and effect visually
 * adjacent (a judgment call, see docs/DECISIONS.md).
 *
 * The former per-level H1/H2/... coverage-percentage chip row (a live
 * readout under the pile-heights slider) was removed in the Workspace
 * two-column redesign, per explicit product-owner feedback that it
 * "connects to nothing actionable" for a non-technical user -- see
 * docs/ITERATION_03_PLAN.md and docs/DECISIONS.md. `levels` is no longer
 * accepted as a prop: it was only ever used to build those chips --
 * `findSmallRegions` below needs only `heightIndex`/`width`/`height`.
 *
 * "Needle & pile" also gained two optional mm inputs (Iteration 04,
 * docs/ITERATION_04_PLAN.md): needle diameter/throw drive a needle-
 * geometry width floor that reshapes narrow regions during generation.
 * No warning banner and no per-region/per-level indicator for this one --
 * per explicit product-owner direction, the reshaped pattern is the only
 * signal surfaced.
 */
export function ReliefControls({
  settings,
  onChange,
  heightIndex,
  width,
  height,
  needleGeometry,
  onNeedleGeometryChange,
}: Props): JSX.Element {
  const minRegionPx = useMemo(
    () => minRegionPxForPreset(settings.minRegionPreset, width, height),
    [settings.minRegionPreset, width, height],
  );

  const smallRegions = useMemo(
    () => (heightIndex ? findSmallRegions(heightIndex, width, height, minRegionPx) : []),
    [heightIndex, width, height, minRegionPx],
  );

  return (
    <>
      <div className="control-group rail-section" id="rail-needle-pile">
        <h3>Needle &amp; pile</h3>
        <div className="field">
          <label htmlFor="levels">Number of pile heights ({settings.levels})</label>
          <input
            id="levels"
            type="range"
            min={2}
            max={12}
            value={settings.levels}
            onChange={(e) => onChange({ levels: Number(e.target.value) })}
          />
          <p className="helper-text">
            How many distinct heights this pattern uses. If your needle has fewer settings than
            this, some heights will share a setting.
          </p>
        </div>

        <div className="field">
          <label htmlFor="needle-diameter">Needle diameter (mm)</label>
          <DecimalNumberInput
            id="needle-diameter"
            value={needleGeometry.diameterMm === 0 ? null : needleGeometry.diameterMm}
            placeholder="Not set"
            onChange={(diameterMm) => onNeedleGeometryChange({ diameterMm: diameterMm ?? 0 })}
          />
        </div>
        <div className="field">
          <label htmlFor="needle-throw">Needle throw / shaft length (mm)</label>
          <DecimalNumberInput
            id="needle-throw"
            value={needleGeometry.throwMm === 0 ? null : needleGeometry.throwMm}
            placeholder="Not set"
            onChange={(throwMm) => onNeedleGeometryChange({ throwMm: throwMm ?? 0 })}
          />
          <p className="helper-text">
            Both optional. When set, narrow regions are automatically widened to whatever your
            needle can actually punch cleanly at each pile height.
          </p>
        </div>
      </div>

      <div className="control-group rail-section" id="rail-punch-detail">
        <h3>Punch detail</h3>
        <div className="field">
          <label htmlFor="min-region">Smallest punchable region</label>
          <select
            id="min-region"
            value={settings.minRegionPreset}
            onChange={(e) => onChange({ minRegionPreset: e.target.value as MinRegionPreset })}
          >
            {MIN_REGION_PRESET_ORDER.map((preset) => (
              <option key={preset} value={preset}>
                {MIN_REGION_PRESET_LABELS[preset]}
              </option>
            ))}
          </select>
          <p className="helper-text">{MIN_REGION_PRESET_DESCRIPTIONS[settings.minRegionPreset]}</p>
        </div>
        {heightIndex && smallRegions.length > 0 && (
          <p role="alert" className="warning-banner">
            {smallRegions.length} region{smallRegions.length === 1 ? '' : 's'} are smaller than the
            minimum punchable size ({minRegionPx}px) and may be difficult to punch reliably.
            Consider raising the minimum region size or lowering the level count.
          </p>
        )}
      </div>

      <div className="control-group rail-section" id="rail-shape-interpretation">
        <h3>Shape interpretation</h3>
        <div className="field">
          <label htmlFor="intensity">Relief depth</label>
          <input
            id="intensity"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.intensity}
            onChange={(e) => onChange({ intensity: Number(e.target.value) })}
          />
          <p className="helper-text">
            How dramatic the height differences are. Lower this to flatten subtle bumps toward one
            average height.
          </p>
        </div>

        <div className="field">
          <label htmlFor="smoothing">Smoothing</label>
          <input
            id="smoothing"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.smoothingStrength}
            onChange={(e) => onChange({ smoothingStrength: Number(e.target.value) })}
          />
          <p className="helper-text">
            Smooths tiny bumps so they don&apos;t turn into separate punch heights.
          </p>
        </div>

        <label>
          <input
            type="checkbox"
            checked={settings.invert}
            onChange={(e) => onChange({ invert: e.target.checked })}
          />{' '}
          Raise near surfaces
        </label>
        <p className="helper-text">
          Choose whether the part of the model closest to your view becomes the tallest loops or the
          shortest.
        </p>

        <details className="advanced-controls">
          <summary>Advanced shape controls</summary>
          <div className="field">
            <label htmlFor="quant-mode">Height band spacing</label>
            <select
              id="quant-mode"
              value={settings.quantizationMode}
              onChange={(e) =>
                onChange({ quantizationMode: e.target.value as ReliefSettings['quantizationMode'] })
              }
            >
              <option value="equal-interval">Even spacing</option>
              <option value="quantile">Balanced by shape</option>
            </select>
            <p className="helper-text">
              Even spacing splits the range into equal steps. Balanced spacing gives each pile
              height roughly the same share of the piece -- useful for lopsided models.
            </p>
          </div>

          <div className="field">
            <label htmlFor="edge">Keep edges crisp</label>
            <input
              id="edge"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.edgePreservation}
              onChange={(e) => onChange({ edgePreservation: Number(e.target.value) })}
            />
            <p className="helper-text">
              Keeps sharp transitions (like the rim of a raised shape) less blurred while still
              smoothing flat areas.
            </p>
          </div>
        </details>
      </div>
    </>
  );
}
