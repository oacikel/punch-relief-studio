import { useState } from 'react';
import type { RegionMap } from '@/domain/types';
import type { LegendEntry } from '@/domain/pattern/legend';
import type { PatternDimensions, ExportSettings } from '@/state/appState';
import type { PunchGuideSettings } from '@/domain/pattern/punchGuide';
import { buildSvgPattern, type PatternView } from '@/export/svgPattern';
import { downloadSvg, svgToPngBlob, downloadBlob } from '@/export/download';
import { computeTiling, cmToCssPx } from '@/export/printTiling';
import { withExtension } from '@/domain/filenameSanitize';
import { usePatternSvgUrl } from '@/hooks/usePatternSvgUrl';
import type { ProjectFile } from '@/domain/projectSchema';

interface Props {
  regionMap: RegionMap;
  legend: LegendEntry[];
  dimensions: PatternDimensions;
  onDimensionsChange: (patch: Partial<PatternDimensions>) => void;
  exportSettings: ExportSettings;
  onExportSettingsChange: (patch: Partial<ExportSettings>) => void;
  onSaveProjectJson: () => void;
  onLoadProjectJson: (project: ProjectFile) => void;
  /** Iteration 02 Stage C: the same punch-guide setting shown on the
   * on-screen Preview pattern, applied to every export/print path too --
   * what you preview is what prints. */
  punchGuide: PunchGuideSettings;
  /** Iteration 03 Round 1: the rest of Preview's on-screen pattern-display
   * state (pattern view mode, grid, mirrored, region labels), read
   * directly here instead of this panel owning a second, independent copy
   * of the same controls. This reverses the Stage C decision that let
   * screen and print settings diverge -- see docs/DECISIONS.md. */
  screenView: PatternView;
  screenShowGrid: boolean;
  screenMirrored: boolean;
  screenShowLabels: boolean;
}

/**
 * Compact export/print panel, rendered inside the Preview stage as of
 * Iteration 02 Stage A (formerly its own "Export" workflow stage -- see
 * docs/ITERATION_02_PLAN.md). The hidden `.print-pages` block is
 * unaffected by whether the disclosure is open or closed -- it lives
 * outside the `<details>` element so printing always works regardless of
 * the panel's on-screen state.
 *
 * As of Iteration 03 Round 1, this panel no longer owns its own "Export
 * pattern view" selector or "Print region labels" checkbox (both deleted
 * -- see the `screenView`/`screenShowGrid`/`screenMirrored`/
 * `screenShowLabels` props above), and no longer renders a Calibration
 * section (calibration UI was removed app-wide by explicit, reversible
 * product decision -- see docs/ITERATION_03_PLAN.md #6; the underlying
 * `CalibrationEditor`/`src/domain/calibration.ts` are untouched, just not
 * referenced here anymore). See docs/ITERATION_03_PLAN.md #11 and
 * docs/DECISIONS.md for both reversals.
 */
export function ExportPanel({
  regionMap,
  legend,
  dimensions,
  onDimensionsChange,
  exportSettings,
  onExportSettingsChange,
  onSaveProjectJson,
  onLoadProjectJson,
  punchGuide,
  screenView,
  screenShowGrid,
  screenMirrored,
  screenShowLabels,
}: Props): JSX.Element {
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

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
  // `actualSizeCm` is always supplied here, even though `computeTiling`'s
  // 'actual-size' path no longer reads it (see printTiling.ts -- it now
  // short-circuits on pageSize before touching `getPageDimensionsCm`/
  // `actualSizeCm` at all). Originally added because the previous
  // implementation of `computeTiling` called `getPageDimensionsCm`
  // unconditionally, which threw when `pageSize` was "actual-size" and
  // `actualSizeCm` was omitted -- found in Stage D verification: selecting
  // "Actual project size" crashed the whole app (uncaught past the
  // top-level ErrorBoundary). Kept passed here as the semantically correct
  // value regardless (it's a no-op for the 'a4'/'letter' cases, which
  // never read it) rather than relying on the current internal
  // short-circuit as the only thing preventing this call from needing it.
  // Passing `undefined` for `marginCm` keeps its own default.
  const tiling = computeTiling(
    safeDimensions.widthCm,
    safeDimensions.heightCm,
    exportSettings.pageSize,
    exportSettings.overlapCm,
    undefined,
    { widthCm: safeDimensions.widthCm, heightCm: safeDimensions.heightCm },
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
      view: screenView,
      showGrid: screenShowGrid,
      showLabels: screenShowLabels,
      mirrored: screenMirrored,
      punchGuide,
    });
    downloadSvg(result.svg, withExtension('punch-relief-pattern', 'svg'));
  };

  const exportPng = async (): Promise<void> => {
    const result = buildSvgPattern(regionMap, legend, {
      widthCm: safeDimensions.widthCm,
      heightCm: safeDimensions.heightCm,
      view: screenView,
      showGrid: screenShowGrid,
      showLabels: screenShowLabels,
      mirrored: screenMirrored,
      punchGuide,
    });
    const widthPx = Math.round(safeDimensions.widthCm * 40);
    const heightPx = Math.round(safeDimensions.heightCm * 40);
    const blob = await svgToPngBlob(result.svg, widthPx, heightPx);
    downloadBlob(blob, withExtension('punch-relief-pattern', 'png'));
  };

  const printPdf = (): void => {
    // Native browser print-to-PDF, not a bundled PDF library -- see
    // docs/DECISIONS.md for why. window.print() respects the print
    // stylesheet (@page sizing, tiling markup) rendered on this page --
    // specifically the .print-pages block below, which is the only thing
    // the print stylesheet leaves visible.
    window.print();
  };

  // Built once here (not per-tile) so every print page reuses the same
  // rendered pattern image via a CSS "clip window" instead of re-rendering
  // the SVG per tile.
  const { url: printImageUrl } = usePatternSvgUrl(regionMap, legend, {
    widthCm: safeDimensions.widthCm,
    heightCm: safeDimensions.heightCm,
    view: screenView,
    showGrid: screenShowGrid,
    showLabels: screenShowLabels,
    mirrored: screenMirrored,
    punchGuide,
  });
  const fullWidthPx = cmToCssPx(safeDimensions.widthCm);
  const fullHeightPx = cmToCssPx(safeDimensions.heightCm);

  return (
    <>
      <details
        className="export-panel"
        open={detailsOpen}
        onToggle={(e) => setDetailsOpen(e.currentTarget.open)}
      >
        <summary>Export &amp; print</summary>
        <div className="export-controls">
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

          <p className="helper-text">
            Export and print always match what Preview is currently showing above -- pattern view,
            grid, mirrored, region labels, and punch guide. Change those there; there's nothing to
            set twice.
          </p>

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
            Reopening a project restores settings and colors -- if it was made from your own
            imported file (not a built-in sample), you'll need to re-select that file too, since the
            original model isn't embedded in the project JSON. See docs/DECISIONS.md.
          </p>
        </div>
      </details>

      {/* Hidden on screen; this is the only thing the print stylesheet
          leaves visible (see @media print in styles.css). "Print / Save as
          PDF" previously called window.print() against the controls above
          -- which never contained the pattern itself -- so a print/PDF was
          just the export form, not the pattern. Each .print-page clips a
          full-size copy of the pattern image to that tile's region via a
          negative offset, so every page prints at true physical scale. */}
      <div className="print-pages" aria-hidden="true">
        {tiling.pages.map((tile) => {
          const tileWidthPx = cmToCssPx(tile.x1Cm - tile.x0Cm);
          const tileHeightPx = cmToCssPx(tile.y1Cm - tile.y0Cm);
          return (
            <div
              key={tile.pageNumber}
              className="print-page"
              style={{ width: tileWidthPx, height: tileHeightPx }}
            >
              <div
                className="print-page-crop"
                style={{
                  width: fullWidthPx,
                  height: fullHeightPx,
                  marginLeft: -cmToCssPx(tile.x0Cm),
                  marginTop: -cmToCssPx(tile.y0Cm),
                }}
              >
                {printImageUrl && (
                  <img
                    src={printImageUrl}
                    alt=""
                    style={{ width: fullWidthPx, height: fullHeightPx, display: 'block' }}
                  />
                )}
              </div>
              {tiling.pages.length > 1 && (
                <>
                  <span className="print-page-number">
                    Page {tile.pageNumber} of {tiling.pages.length} (row {tile.row + 1}, col{' '}
                    {tile.col + 1})
                  </span>
                  <span className="print-crop-mark print-crop-mark--tl" />
                  <span className="print-crop-mark print-crop-mark--tr" />
                  <span className="print-crop-mark print-crop-mark--bl" />
                  <span className="print-crop-mark print-crop-mark--br" />
                </>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
