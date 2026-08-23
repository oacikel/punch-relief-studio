import type { RotationDeg } from '@/state/appState';

interface Props {
  rotationDeg: RotationDeg;
  onAxisChange: (axis: keyof RotationDeg, value: number) => void;
  onReset: () => void;
  /** Two instances of this component render at once (Import's Viewport3D
   * and Workspace's Finished-piece simulation panel), both bound to the
   * same `AppState.modelRotationDeg` -- see docs/DECISIONS.md. Distinct
   * `idPrefix`es keep their `id`/`htmlFor` pairs from colliding, which
   * would otherwise make `getByLabel` queries (and real screen-reader
   * label association) ambiguous between the two. */
  idPrefix: string;
  /** Optional heading/help text override -- Workspace's copy renders
   * without the "Not every import lands upright" framing sentence, which
   * only makes sense the first time a user sees these controls (on
   * Import). Defaults to that Import framing. */
  helperText?: string;
}

// Pitch/yaw tilt the model relative to the view, so they change what the
// camera sees for almost any shape; roll spins it around the view axis
// itself, which is a no-op for anything close to radially symmetric (a
// ripple, a bowl, a cylinder viewed end-on) -- ordered so the controls
// most likely to show a visible effect come first.
const AXES = ['pitch', 'yaw', 'roll'] as const;

/**
 * Model-straightening rotation controls (Roll/Pitch/Yaw sliders + Reset),
 * extracted as a shared presentational component (Iteration 03's
 * combined-workspace change -- docs/ITERATION_03_PLAN.md #13) so both
 * Import's `Viewport3D` and Workspace's `SimulationPanel` can render the
 * same controls against one shared `AppState.modelRotationDeg` value. No
 * domain logic here -- purely controlled inputs, per CLAUDE.md's component
 * boundary.
 */
export function RotationControls({
  rotationDeg,
  onAxisChange,
  onReset,
  idPrefix,
  helperText = 'Not every import lands upright. Rotate the model itself (not just the view) to straighten it before generating a relief.',
}: Props): JSX.Element {
  return (
    <div
      role="group"
      aria-label="Straighten model"
      style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}
    >
      {helperText && (
        <p className="helper-text" style={{ margin: 0 }}>
          {helperText}
        </p>
      )}
      {AXES.map((axis) => (
        <div key={axis} className="field" style={{ marginBottom: 0 }}>
          <label htmlFor={`${idPrefix}-rotate-${axis}`}>
            {axis[0]?.toUpperCase()}
            {axis.slice(1)} ({rotationDeg[axis]}°)
          </label>
          <input
            id={`${idPrefix}-rotate-${axis}`}
            type="range"
            min={-180}
            max={180}
            step={1}
            value={rotationDeg[axis]}
            onChange={(e) => onAxisChange(axis, Number(e.target.value))}
          />
        </div>
      ))}
      <button type="button" onClick={onReset} style={{ alignSelf: 'flex-start' }}>
        Reset rotation
      </button>
      <p className="helper-text" style={{ margin: 0 }}>
        Roll may not visibly change a shape that&rsquo;s symmetric around this view &mdash; try
        Pitch or Yaw if a slider doesn&rsquo;t seem to do anything.
      </p>
    </div>
  );
}
