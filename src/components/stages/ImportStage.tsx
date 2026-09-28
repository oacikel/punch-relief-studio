import { useRef, useState } from 'react';
import { BUILTIN_SAMPLES } from '@/domain/samples';
import { validateFile } from '@/domain/import/validation';
import { PreviewExpectations } from '@/components/stages/PreviewExpectations';

interface Props {
  onSelectSample: (sampleId: string) => void;
  onFilesSelected: (files: File[]) => void;
  onImageSelected: (file: File) => void;
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
 * Import stage: one drag-and-drop / file-picker entry point for flat images
 * and 3D models, followed by built-in 3D samples (no upload required, per
 * product spec §5). OBJ companion MTL/texture files remain selectable as a
 * group. The primary file type routes to the corresponding image or model
 * handler, and malformed/unsupported drops surface an inline error.
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
  onImageSelected,
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
      const model = files.find((file) => /\.(stl|obj)$/i.test(file.name));
      if (model) {
        validateFile(model);
        setError(null);
        onFilesSelected(files);
        return;
      }
      const image = files.find((file) => /\.(png|jpe?g|webp)$/i.test(file.name));
      if (!image) {
        throw new Error('Choose a PNG, JPEG, WebP, STL, or OBJ file.');
      }
      setError(null);
      onImageSelected(image);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import this file.');
    }
  };

  return (
    <section className="stage-panel" aria-labelledby="import-heading">
      <p className="eyebrow">Start a new pattern</p>
      <h2 id="import-heading">Start with your artwork</h2>
      <p className="stage-lede">
        Import a 2D image or 3D model. Everything stays private in your browser.
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
          {hasModel ? `Source: ${loadedModelLabel ?? 'your file'} · Change` : 'Import your artwork'}
        </summary>
        <div className="import-picker__body">
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
            <strong>Drop a 2D image or 3D model here</strong>
            <p className="helper-text">
              PNG, JPEG, WebP, STL, or OBJ with optional MTL and texture files
            </p>
            <button
              className="primary-button"
              type="button"
              onClick={() => inputRef.current?.click()}
            >
              Choose file(s)
            </button>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".stl,.obj,.mtl,.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
              className="visually-hidden"
              onChange={(event) => {
                if (event.target.files) handleFiles(event.target.files);
                event.target.value = '';
              }}
              aria-label="Choose a 2D image or 3D model to import"
            />
          </div>

          <div className="section-divider">
            <span>or try a 3D sample</span>
          </div>
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
  /** EXP-003 ("clarify the single-viewpoint preview"): replace the one-line
   * single-viewpoint helper text with the fuller `PreviewExpectations`
   * notice. App.tsx owns the variant read; this component only renders what
   * it's told to. Defaults to false so every existing render site keeps its
   * current behaviour. */
  showPreviewExpectations?: boolean;
}

/** The post-load half of the merged Import/Orient stage: framing text
 * (moved verbatim from the former OrientStage) plus the "next action" the
 * product owner asked for, so it's never unclear how to move on. The 3D
 * viewport itself renders separately (see ImportStage's own doc comment).
 *
 * This is the last screen before the Workspace preview, which makes it the
 * only place an expectation about that preview can be set in advance -- hence
 * EXP-003's notice living here (see `PreviewExpectations`). Either way the
 * single-viewpoint limitation is stated in-app, per CLAUDE.md; the experiment
 * only varies how concretely. */
export function ImportOrientSection({
  onContinue,
  showPreviewExpectations = false,
}: OrientSectionProps): JSX.Element {
  return (
    <section
      className={
        showPreviewExpectations
          ? 'stage-panel orient-actions orient-actions--expanded'
          : 'stage-panel orient-actions'
      }
      aria-labelledby="orient-heading"
    >
      <div>
        <p className="eyebrow">Almost there</p>
        <h2 id="orient-heading">Is this the view you want?</h2>
        {showPreviewExpectations ? (
          <PreviewExpectations />
        ) : (
          <p className="helper-text">
            The visible surface becomes your pattern. Hidden and back surfaces are not included, so
            this is a single-viewpoint relief rather than a full 3D reconstruction.
          </p>
        )}
      </div>
      <button className="primary-button" type="button" onClick={onContinue}>
        Create my pattern &rarr;
      </button>
    </section>
  );
}
