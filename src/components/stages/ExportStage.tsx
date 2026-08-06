import type { RegionMap } from '@/domain/types';
import type { LegendEntry } from '@/domain/pattern/legend';
import type { CalibrationProfile } from '@/domain/calibration';
import type { PatternDimensions, ExportSettings } from '@/state/appState';
import { buildSvgPattern } from '@/export/svgPattern';
import { downloadSvg, svgToPngBlob, downloadBlob, downloadJson } from '@/export/download';
import { computeTiling } from '@/export/printTiling';
import { withExtension } from '@/domain/filenameSanitize';
import { CalibrationEditor } from '@/components/CalibrationEditor';

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
}: Props): JSX.Element {
  const tiling = computeTiling(dimensions.widthCm, dimensions.heightCm, exportSettings.pageSize, exportSettings.overlapCm);

  const exportSvg = (): void => {
    const result = buildSvgPattern(regionMap, legend, {
      widthCm: dimensions.widthCm,
      heightCm: dimensions.heightCm,
      view: 'combined',
      showGrid: false,
      showLabels: true,
      mirrored: exportSettings.orientation === 'mirrored',
    });
    downloadSvg(result.svg, withExtension('punch-relief-pattern', 'svg'));
  };

  const exportPng = async (): Promise<void> => {
    const result = buildSvgPattern(regionMap, legend, {
      widthCm: dimensions.widthCm,
      heightCm: dimensions.heightCm,
      view: 'combined',
      showGrid: false,
      showLabels: true,
      mirrored: exportSettings.orientation === 'mirrored',
    });
    const widthPx = Math.round(dimensions.widthCm * 40);
    const heightPx = Math.round(dimensions.heightCm * 40);
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
            const heightCm = dimensions.lockAspect
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
          onChange={(e) => onExportSettingsChange({ pageSize: e.target.value as ExportSettings['pageSize'] })}
        >
          <option value="a4">A4</option>
          <option value="letter">US Letter</option>
          <option value="actual-size">Actual project size</option>
        </select>
      </div>
      <p className="helper-text">
        This pattern will print across {tiling.pages.length} page{tiling.pages.length === 1 ? '' : 's'} (
        {tiling.cols} × {tiling.rows}) with {exportSettings.overlapCm}cm overlap. Always check the printed
        scale-check square with a ruler before cutting fabric -- some printers silently rescale to
        "fit page".
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
      </div>

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

export { downloadJson };
