import { useRef, useState } from 'react';
import { BUILTIN_SAMPLES } from '@/domain/samples';
import { validateFile } from '@/domain/import/validation';

interface Props {
  onSelectSample: (sampleId: string) => void;
  onFilesSelected: (files: File[]) => void;
  /** Usability fix (docs/DECISIONS.md): whether a model has already been
   * loaded (from `workflow.hasModel`, the same signal that gates
   * `ImportOrientSection` in App.tsx -- reused here rather than inventing a
   * second "has a model" concept). Drives whether the sample-picker/drop-zone
   * below defaults open or collapsed. */
  hasModel: boolean;
  /** Display label for the currently-loaded model (sample name or original
   * filename), shown in the collapsed summary so the user knows what's
   * loaded without expanding the picker. Null when nothing descriptive is
   * available yet (still resolves to a generic label in the summary). */
  loadedModelLabel: string | null;
}

/**
 * Import stage: built-in samples (no upload required, per product spec
 * §5), plus drag-and-drop / file-picker import for STL and OBJ(+MTL+local
 * textures). Validates before handing files off, and never crashes on a
 * malformed drop -- errors surface as an inline, field-associated message.
 *
 * As of Iteration 02 Stage A, model orientation also happens on this stage
 * (formerly a separate "Orient" stage -- see docs/ITERATION_02_PLAN.md):
 * once a model has loaded, App.tsx additionally renders `ImportOrientSection`
 * (below) and the shared 3D viewport right after this component.
 *
 * Usability fix (docs/DECISIONS.md, follow-up to "move the Import 3D orient
 * viewport above the fold"): the sample cards + drop zone below used to stay
 * fully rendered and visible at their full ~700px height even after a model
 * had already loaded, which is what actually pushed the viewport and
 * "Continue to Workspace" button far below the fold -- reordering
 * `ImportOrientSection` relative to `Viewport3D` in App.tsx alone couldn't
 * fix that, since every element involved was still on-screen either way.
 * The real fix: once `hasModel` is true, this picker collapses into a
 * `<details>` disclosure (closed by default, one-line `<summary>`) instead
 * of occupying its full height, while staying reachable so the user can
 * still change their mind and load a different model without restarting the
 * app.
 */
export function ImportStage({
  onSelectSample,
  onFilesSelected,
  hasModel,
  loadedModelLabel,
}: Props): JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = (fileList: FileList | File[]): void => {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    try {
      const primary = files.find((f) => /\.(stl|obj)$/i.test(f.name)) ?? files[0];
      if (!primary) return;
      validateFile(primary);
      setError(null);
      onFilesSelected(files);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import this file.');
    }
  };

  return (
    <section className="stage-panel" aria-labelledby="import-heading">
      <p className="eyebrow">Start a new pattern</p>
      <h2 id="import-heading">Choose a 3D model</h2>
      <p className="stage-lede">
        Pick a sample or bring your own STL or OBJ. Everything stays private in your browser.
      </p>

      {/* Usability fix (docs/DECISIONS.md): `open={!hasModel}` is only
          re-applied by React when its *value* changes -- so this forces a
          collapse the moment `hasModel` flips false -> true (a model just
          loaded), but afterwards leaves the user's own expand/collapse
          clicks alone (React won't fight a native toggle when the prop it
          last rendered hasn't changed). That gives "collapsed by default
          once loaded" without turning this into a fully controlled
          component. */}
      <details className="import-picker" open={!hasModel}>
        <summary>
          {hasModel
            ? `Model loaded: ${loadedModelLabel ?? 'your model'} — choose a different file`
            : 'Choose a model to import'}
        </summary>
        <div className="import-picker__body">
          <h3>Start with a sample</h3>
          <div className="sample-grid">
            {BUILTIN_SAMPLES.map((sample) => (
              <button
                className="sample-card"
                key={sample.id}
                type="button"
                onClick={() => onSelectSample(sample.id)}
              >
                <strong>{sample.name}</strong>
                <span className="helper-text">{sample.description}</span>
              </button>
            ))}
          </div>

          <div className="section-divider">
            <span>or</span>
          </div>
          <h3>Import your own</h3>
          <div
            className={dragActive ? 'drop-zone drop-zone--active' : 'drop-zone'}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              handleFiles(e.dataTransfer.files);
            }}
          >
            <span className="drop-zone__icon" aria-hidden="true">
              ↥
            </span>
            <strong>Drop your model here</strong>
            <p className="helper-text">STL or OBJ, including local MTL and texture files</p>
            <button
              className="primary-button"
              type="button"
              onClick={() => inputRef.current?.click()}
            >
              Choose files
            </button>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".stl,.obj,.mtl,image/*"
              className="visually-hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
              aria-label="Choose model files to import"
            />
          </div>
        </div>
      </details>

      {error && (
        <p role="alert" className="warning-banner">
          {error}
        </p>
      )}
    </section>
  );
}

interface OrientSectionProps {
  onContinue: () => void;
}

/** The post-load half of the merged Import/Orient stage: framing text
 * (moved verbatim from the former OrientStage) plus the "next action" the
 * product owner asked for, so it's never unclear how to move on. The 3D
 * viewport itself renders separately (see ImportStage's own doc comment). */
export function ImportOrientSection({ onContinue }: OrientSectionProps): JSX.Element {
  return (
    <section className="stage-panel orient-actions" aria-labelledby="orient-heading">
      <div>
        <p className="eyebrow">Almost there</p>
        <h2 id="orient-heading">Is this the view you want?</h2>
        <p className="helper-text">
          The visible surface becomes your pattern. Hidden and back surfaces are not included, so
          this is a single-viewpoint relief rather than a full 3D reconstruction.
        </p>
      </div>
      <button className="primary-button" type="button" onClick={onContinue}>
        Create my pattern &rarr;
      </button>
    </section>
  );
}
