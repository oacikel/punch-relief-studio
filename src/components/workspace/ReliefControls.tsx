import { useMemo } from 'react';
import type { HeightLevel, ReliefSettings } from '@/domain/types';
import { findSmallRegions } from '@/domain/regionCleanup';
import {
  MIN_REGION_PRESET_ORDER,
  MIN_REGION_PRESET_LABELS,
  MIN_REGION_PRESET_DESCRIPTIONS,
  minRegionPxForPreset,
  type MinRegionPreset,
} from '@/domain/pattern/minRegionPreset';

interface Props {
  settings: ReliefSettings;
  onChange: (patch: Partial<ReliefSettings>) => void;
  /** Live per-level coverage readout, folded in from the former
   * HeightStage.tsx (Iteration 03's combined-workspace change -- see
   * docs/ITERATION_03_PLAN.md #13) -- `null` before the first relief has
   * generated. */
  levels: HeightLevel[] | null;
  heightIndex: Int16Array | null;
  width: number;
  height: number;
}

/**
 * "Needle & pile" / "Punch detail" / "Shape interpretation" control groups
 * -- the former `ReliefStage.tsx` content verbatim, now rendered inline in
 * the Workspace rail instead of on its own page, with the manual "Generate
 * relief" button removed (live regeneration replaces it -- see
 * `src/hooks/useLiveRelief.ts`) and the former `HeightStage.tsx`'s
 * per-level coverage table folded into a small live chip readout directly
 * under the pile-heights slider, since it's really just live feedback for
 * that one control rather than its own destination. The small-region
 * warning (also from HeightStage.tsx) moves into "Punch detail" instead,
 * directly under the min-region preset that drives it -- keeping cause and
 * effect visually adjacent (a judgment call, see docs/DECISIONS.md).
 */
export function ReliefControls({
  settings,
  onChange,
  levels,
  heightIndex,
  width,
  height,
}: Props): JSX.Element {
  const counts = useMemo(() => {
    if (!levels || !heightIndex) return null;
    const c = new Array(levels.length).fill(0) as number[];
    for (const v of heightIndex) if (v >= 0) c[v] = (c[v] ?? 0) + 1;
    return c;
  }, [levels, heightIndex]);

  const minRegionPx = useMemo(
    () => minRegionPxForPreset(settings.minRegionPreset, width, height),
    [settings.minRegionPreset, width, height],
  );

  const smallRegions = useMemo(
    () => (heightIndex ? findSmallRegions(heightIndex, width, height, minRegionPx) : []),
    [heightIndex, width, height, minRegionPx],
  );

  const totalForeground = counts ? counts.reduce((a, b) => a + b, 0) || 1 : 1;

  return (
    <>
      <div className="control-group">
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
        {levels && counts && (
          <ul
            aria-label="Pile height coverage"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              margin: '8px 0 0',
              padding: 0,
              listStyle: 'none',
            }}
          >
            {levels.map((level) => {
              const share = ((counts[level.index] ?? 0) / totalForeground) * 100;
              return (
                <li key={level.index} className="level-chip">
                  H{level.index + 1} {share.toFixed(1)}%
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="control-group">
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

      <div className="control-group">
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
