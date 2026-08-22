import type { ReliefSettings } from '@/domain/types';
import {
  MIN_REGION_PRESET_ORDER,
  MIN_REGION_PRESET_LABELS,
  MIN_REGION_PRESET_DESCRIPTIONS,
  type MinRegionPreset,
} from '@/domain/pattern/minRegionPreset';

interface Props {
  settings: ReliefSettings;
  onChange: (patch: Partial<ReliefSettings>) => void;
  onGenerate: () => void;
  processing: boolean;
  error: string | null;
}

/** Relief stage: all the depth-processing controls from product spec §8,
 * reorganized in Iteration 02 Stage B around real punch-needle concepts
 * instead of engineering vocabulary -- see docs/ITERATION_02_PLAN.md §5 for
 * the control-by-control audit this layout implements verbatim (label,
 * helper text, Basic/Advanced tier, and grouping all come from that table).
 * The 3D viewport is rendered by the parent (App) as the same persistent
 * instance shared with the Import stage's orientation section (formerly a
 * separate "Orient" stage), so re-orienting there doesn't lose these
 * settings and the orientation chosen there isn't lost either. As of Stage
 * B, App.tsx also renders that viewport in a sticky right-hand column next
 * to this stage's controls (see the `.relief-preview-col` styling in
 * styles.css and the Stage B decision note in docs/DECISIONS.md) -- this
 * component itself has no layout opinion about that, it only owns the
 * control markup. */
export function ReliefStage({
  settings,
  onChange,
  onGenerate,
  processing,
  error,
}: Props): JSX.Element {
  return (
    <section className="stage-panel" aria-labelledby="relief-heading">
      <h2 id="relief-heading">Create the relief</h2>

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
        <p className="helper-text">
          See exactly how these heights map to your needle&apos;s settings -- and calibrate them --
          on the Height Levels step, once you&apos;ve generated a relief below.
        </p>
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

      <div style={{ marginTop: 16 }}>
        <button type="button" onClick={onGenerate} disabled={processing}>
          {processing ? 'Processing…' : 'Generate relief'}
        </button>
        <p className="helper-text" aria-live="polite">
          {processing
            ? 'Processing the relief -- this runs in the background and keeps the app responsive.'
            : ''}
        </p>
      </div>

      {error && (
        <p role="alert" className="warning-banner">
          {error}
        </p>
      )}
    </section>
  );
}
