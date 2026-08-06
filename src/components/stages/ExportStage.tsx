import { useState } from 'react';
import type { RegionMap } from '@/domain/types';
import type { LegendEntry } from '@/domain/pattern/legend';
import type { CalibrationProfile } from '@/domain/calibration';
import type { PatternDimensions, ExportSettings } from '@/state/appState';
import { buildSvgPattern } from '@/export/svgPattern';
import { downloadSvg, svgToPngBlob, downloadBlob } from '@/export/download';
import { computeTiling } from '@/export/printTiling';
import { withExtension } from '@/domain/filenameSanitize';
import { CalibrationEditor } from '@/components/CalibrationEditor';
import type { ProjectFile } from '@/domain/projectSchema';

interface Props {
  regionMap: RegionMap;
  legend: LegendEntry[];
  dimensions: PatternDimensions;
  onDimensionsChange: (patch: Partial<PatternDimensions>) => void;
  exportSettings: ExportSettings;
  onExportSettingsChange: (patch: Partial<ExportSettings>) => void;
  calibrationProfile: CalibrationProfile;
  savedProfiles: CalibrationProfile[];
  onCalibrationChange: (profile: CalibrationProfile) => void;
  onCalibrationSave: (profile: CalibrationProfile) => void;
  onCalibrationSelect: (profile: CalibrationProfile) => void;
  onSaveProjectJson: () => void;
  onLoadProjectJson: (project: ProjectFile) => void;
}

/** Export stage: PNG/SVG/print-PDF pattern export, project JSON, and the
 * calibration editor (profiles are exported/imported from here too, per
 * product spec §9/§13). */
export function ExportStage({
  regionMap,
  legend,
  dimensions,
  onDimensionsChange,
  exportSettings,
  onExportSettingsChange,
  calibrationProfile,
  savedProfiles,
  onCalibrationChange,
  onCalibrationSave,
  onCalibrationSelect,
  onSaveProjectJson,
  onLoadProjectJson,
}: Props): JSX.Element {
  const [loadError, setLoadError] = useState<string | null>(null);
  // Guard against a cleared/invalid width producing NaN/Infinity, which
  // would otherwise propagate into the tiling math and SVG dimensions
  // below (a real crash path found in implementation review).
  const safeDimensions =
    Number.isFinite(dimensions.widthCm) &&
    dimensions.widthCm > 0 &&
    Number.isFinite(dimensions.heightCm) &&
    dimensions.heightCm > 0
      ? dimensions
      : { ...dimensions, widthCm: 1, heightCm: 1 };
  const tiling = computeTiling(
    safeDimensions.widthCm,
    safeDimensions.heightCm,
    exportSettings.pageSize,
    exportSettings.overlapCm,
  );

  const handleLoadProject = async (file: File): Promise<void> => {
    try {
      const { deserializeProject } = await import('@/persistence/projectStore');
      const text = await file.text();
      const project = deserializeProject(text);
      onLoadProjectJson(project);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load this project file.');
    }
  };

  const exportSvg = (): void => {
    const result = buildSvgPattern(regionMap, legend, {
      widthCm: safeDimensions.widthCm,
      heightCm: safeDimensions.heightCm,
      view: 'combined',
      showGrid: false,
      showLabels: true,
      mirrored: exportSettings.orientation === 'mirrored',
    });
    downloadSvg(result.svg, withExtension('punch-relief-pattern', 'svg'));
  };

  const exportPng = async (): Promise<void> => {
    const result = buildSvgPattern(regionMap, legend, {
      widthCm: safeDimensions.widthCm,
      heightCm: safeDimensions.heightCm,
      view: 'combined',
      showGrid: false,
      showLabels: true,
      mirrored: exportSettings.orientation === 'mirrored',
    });
    const widthPx = Math.round(safeDimensions.widthCm * 40);
    const heightPx = Math.round(safeDimensions.heightCm * 40);
    const blob = await svgToPngBlob(result.svg, widthPx, heightPx);
    downloadBlob(blob, withExtension('punch-relief-pattern', 'png'));
  };

  const printPdf = (): void => {
    // Native browser print-to-PDF, not a bundled PDF library -- see
    // docs/DECISIONS.md for why. window.print() respects the print
    // stylesheet (@page sizing, tiling markup) rendered on this page.
    window.print();
  };

  return (
    <section className="stage-panel" aria-labelledby="export-heading">
      <h2 id="export-heading">Export</h2>

      <div className="field">
        <label htmlFor="width-cm">Width (cm)</label>
        <input
          id="width-cm"
          type="number"
          min={1}
          value={dimensions.widthCm}
          onChange={(e) => {
            const widthCm = Number(e.target.value);
            if (!Number.isFinite(widthCm) || widthCm <= 0) return; // ignore empty/zero/negative input rather than propagating NaN
            const heightCm =
              dimensions.lockAspect && dimensions.widthCm > 0
                ? (widthCm / dimensions.widthCm) * dimensions.heightCm
                : dimensions.heightCm;
            onDimensionsChange({ widthCm, heightCm });
          }}
        />
      </div>
      <div className="field">
        <label htmlFor="height-cm">Height (cm)</label>
        <input
          id="height-cm"
          type="number"
          min={1}
          value={dimensions.heightCm}
          onChange={(e) => onDimensionsChange({ heightCm: Number(e.target.value) })}
        />
      </div>
      <label>
        <input
          type="checkbox"
          checked={dimensions.lockAspect}
          onChange={(e) => onDimensionsChange({ lockAspect: e.target.checked })}
        />{' '}
        Lock aspect ratio
      </label>

      <div className="field">
        <label htmlFor="page-size">Print page size</label>
        <select
          id="page-size"
          value={exportSettings.pageSize}
          onChange={(e) =>
            onExportSettingsChange({ pageSize: e.target.value as ExportSettings['pageSize'] })
          }
        >
          <option value="a4">A4</option>
          <option value="letter">US Letter</option>
          <option value="actual-size">Actual project size</option>
        </select>
      </div>
      <p className="helper-text">
        This pattern will print across {tiling.pages.length} page
        {tiling.pages.length === 1 ? '' : 's'} ({tiling.cols} × {tiling.rows}) with{' '}
        {exportSettings.overlapCm}cm overlap. Always check the printed scale-check square with a
        ruler before cutting fabric -- some printers silently rescale to "fit page".
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        <button type="button" onClick={exportSvg}>
          Export SVG pattern
        </button>
        <button type="button" onClick={() => void exportPng()}>
          Export PNG pattern
        </button>
        <button type="button" onClick={printPdf}>
          Print / Save as PDF
        </button>
        <button type="button" onClick={onSaveProjectJson}>
          Save project settings (JSON)
        </button>
        <label className="field" style={{ marginBottom: 0 }}>
          <span>Load project settings (JSON)</span>
          <input
            type="file"
            accept="application/json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleLoadProject(file);
            }}
          />
        </label>
      </div>
      {loadError && (
        <p role="alert" className="warning-banner">
          {loadError}
        </p>
      )}
      <p className="helper-text">
        Reopening a project restores settings, calibration, and colors -- if it was made from your
        own imported file (not a built-in sample), you'll need to re-select that file too, since the
        original model isn't embedded in the project JSON. See docs/DECISIONS.md.
      </p>

      <h3>Calibration</h3>
      <CalibrationEditor
        profile={calibrationProfile}
        savedProfiles={savedProfiles}
        onChange={onCalibrationChange}
        onSave={onCalibrationSave}
        onSelectSaved={onCalibrationSelect}
      />
    </section>
  );
}
