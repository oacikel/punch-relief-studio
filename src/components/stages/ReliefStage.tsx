import type { ReliefSettings } from '@/domain/types';

interface Props {
  settings: ReliefSettings;
  onChange: (patch: Partial<ReliefSettings>) => void;
  onGenerate: () => void;
  processing: boolean;
  error: string | null;
  children: React.ReactNode;
}

/** Relief stage: all the depth-processing controls from product spec §8,
 * plus the shared viewport (passed as children) so the user can re-orient
 * without losing these settings. */
export function ReliefStage({
  settings,
  onChange,
  onGenerate,
  processing,
  error,
  children,
}: Props): JSX.Element {
  return (
    <section className="stage-panel" aria-labelledby="relief-heading">
      <h2 id="relief-heading">Create the relief</h2>
      {children}

      <div className="field">
        <label htmlFor="levels">Height levels ({settings.levels})</label>
        <input
          id="levels"
          type="range"
          min={3}
          max={8}
          value={settings.levels}
          onChange={(e) => onChange({ levels: Number(e.target.value) })}
        />
      </div>

      <div className="field">
        <label htmlFor="intensity">Relief intensity</label>
        <input
          id="intensity"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={settings.intensity}
          onChange={(e) => onChange({ intensity: Number(e.target.value) })}
        />
      </div>

      <div className="field">
        <label htmlFor="smoothing">Smoothing strength</label>
        <input
          id="smoothing"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={settings.smoothingStrength}
          onChange={(e) => onChange({ smoothingStrength: Number(e.target.value) })}
        />
      </div>

      <div className="field">
        <label htmlFor="edge">Edge preservation</label>
        <input
          id="edge"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={settings.edgePreservation}
          onChange={(e) => onChange({ edgePreservation: Number(e.target.value) })}
        />
      </div>

      <div className="field">
        <label htmlFor="min-region">Minimum region size (px)</label>
        <input
          id="min-region"
          type="number"
          min={1}
          value={settings.minRegionPx}
          onChange={(e) => onChange({ minRegionPx: Number(e.target.value) })}
        />
      </div>

      <div className="field">
        <label htmlFor="resolution">Output resolution (px, longest edge)</label>
        <select
          id="resolution"
          value={settings.outputResolutionPx}
          onChange={(e) =>
            onChange({
              outputResolutionPx: Number(
                e.target.value,
              ) as unknown as ReliefSettings['outputResolutionPx'],
            })
          }
        >
          {[128, 192, 256, 384, 512].map((r) => (
            <option key={r} value={r}>
              {r}px
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="quant-mode">Quantization mode</label>
        <select
          id="quant-mode"
          value={settings.quantizationMode}
          onChange={(e) =>
            onChange({ quantizationMode: e.target.value as ReliefSettings['quantizationMode'] })
          }
        >
          <option value="equal-interval">Equal interval</option>
          <option value="quantile">Quantile (data-driven)</option>
        </select>
      </div>

      <label>
        <input
          type="checkbox"
          checked={settings.invert}
          onChange={(e) => onChange({ invert: e.target.checked })}
        />{' '}
        Invert (near surfaces become low pile instead of high)
      </label>

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
