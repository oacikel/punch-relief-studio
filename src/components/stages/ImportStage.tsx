import { useRef, useState } from 'react';
import { BUILTIN_SAMPLES } from '@/domain/samples';
import { validateFile } from '@/domain/import/validation';

interface Props {
  onSelectSample: (sampleId: string) => void;
  onFilesSelected: (files: File[]) => void;
}

/**
 * Import stage: built-in samples (no upload required, per product spec
 * §5), plus drag-and-drop / file-picker import for STL and OBJ(+MTL+local
 * textures). Validates before handing files off, and never crashes on a
 * malformed drop -- errors surface as an inline, field-associated message.
 */
export function ImportStage({ onSelectSample, onFilesSelected }: Props): JSX.Element {
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
      <h2 id="import-heading">Import a model</h2>
      <p className="helper-text">
        Supported formats: binary or ASCII STL, and OBJ (optionally with a matching .mtl and its
        local texture images -- drop them all in together). Nothing you import ever leaves your
        browser.
      </p>

      <h3>Try a built-in sample</h3>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        {BUILTIN_SAMPLES.map((sample) => (
          <button key={sample.id} type="button" onClick={() => onSelectSample(sample.id)}>
            <strong>{sample.name}</strong>
            <br />
            <span className="helper-text">{sample.description}</span>
          </button>
        ))}
      </div>

      <h3>Or import your own</h3>
      <div
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
        style={{
          border: `2px dashed ${dragActive ? 'var(--color-accent)' : 'var(--color-border)'}`,
          borderRadius: 8,
          padding: 32,
          textAlign: 'center',
        }}
      >
        <p>Drag and drop your STL or OBJ (+ MTL + textures) here</p>
        <button type="button" onClick={() => inputRef.current?.click()}>
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

      {error && (
        <p role="alert" className="warning-banner">
          {error}
        </p>
      )}
    </section>
  );
}
