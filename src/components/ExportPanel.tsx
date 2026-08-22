import { useEffect, useRef, useState } from 'react';
import type { RegionMap } from '@/domain/types';
import type { LegendEntry } from '@/domain/pattern/legend';
import type { CalibrationProfile } from '@/domain/calibration';
import type { PatternDimensions, ExportSettings } from '@/state/appState';
import type { PunchGuideSettings } from '@/domain/pattern/punchGuide';
import { buildSvgPattern, type PatternView } from '@/export/svgPattern';
import { downloadSvg, svgToPngBlob, downloadBlob } from '@/export/download';
import { computeTiling, cmToCssPx } from '@/export/printTiling';
import { withExtension } from '@/domain/filenameSanitize';
import { CalibrationEditor } from '@/components/CalibrationEditor';
import { usePatternSvgUrl } from '@/hooks/usePatternSvgUrl';
import type { ProjectFile } from '@/domain/projectSchema';

const VIEWS: PatternView[] = ['combined', 'color-only', 'height-only', 'contour'];

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
  /** Iteration 02 Stage B: when true, forces this panel's disclosure open
   * and scrolls/focuses the calibration section -- set from App.tsx when
   * the user follows the "Calibrate needle settings" link on the Height
   * Levels stage (see docs/ITERATION_02_PLAN.md §14 decision #1). Optional
   * so existing callers/tests that don't care about this behave exactly as
   * before. */
  focusCalibration?: boolean;
  /** Called once the forced-open/scroll/focus above has happened, so the
   * caller can reset its flag and a later, ordinary visit to Preview
   * doesn't keep re-forcing it. */
  onCalibrationFocused?: () => void;
  /** Iteration 02 Stage C: the same punch-guide setting shown on the
   * on-screen Preview pattern, applied to every export/print path too --
   * what you preview is what prints. */
  punchGuide: PunchGuideSettings;
}

/**
 * Compact export/print panel, rendered inside the Preview stage as of
 * Iteration 02 Stage A (formerly its own "Export" workflow stage -- see
 * docs/ITERATION_02_PLAN.md). Same underlying logic and the same
 * `CalibrationEditor`, just relocated and collapsed behind a `<details>`
 * disclosure so Preview isn't a wall of controls (product owner feedback
 * item 19). The hidden `.print-pages` block is unaffected by whether the
 * disclosure is open or closed -- it lives outside the `<details>` element
 * so printing always works regardless of the panel's on-screen state. */
export function ExportPanel({
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
  focusCalibration = false,
  onCalibrationFocused,
  punchGuide,
}: Props): JSX.Element {
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const calibrationRef = useRef<HTMLDivElement | null>(null);

  // Force the disclosure open when asked to focus calibration (see the
  // "Calibrate needle settings" link on the Height Levels stage).
  useEffect(() => {
    if (focusCalibration) setDetailsOpen(true);
  }, [focusCalibration]);

  // Once open, scroll to and focus the calibration section, then tell the
  // caller so it can clear the flag -- otherwise a later, ordinary visit to
  // Preview would keep re-forcing the panel open. `scrollIntoView` doesn't
  // exist in jsdom (unit tests), so both the ref and the method are
  // optionally chained rather than mocked -- this effect simply becomes a
  // no-op scroll/focus in that environment, which is fine since tests only
  // assert the `open` state and that the callback fired.
  useEffect(() => {
    if (!focusCalibration || !detailsOpen) return;
    calibrationRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    calibrationRef.current?.focus?.();
    onCalibrationFocused?.();
  }, [focusCalibration, detailsOpen, onCalibrationFocused]);
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
  // `actualSizeCm` must always be supplied here (not just when
  // pageSize === 'actual-size') -- `computeTiling` calls
  // `getPageDimensionsCm` unconditionally before its own single-page fast
  // path check, and that throws when pageSize is "actual-size" and
  // actualSizeCm is omitted. Found in Stage D verification: selecting
  // "Actual project size" from the page-size dropdown crashed the whole
  // app (uncaught past the top-level ErrorBoundary) because this call site
  // never passed it. Passing `undefined` for `marginCm` keeps its own
  // default; passing the pattern's own dimensions as `actualSizeCm` is a
  // no-op for the 'a4'/'letter' cases (that branch never reads it) and is
  // exactly the right value for 'actual-size' (a single page sized to the
  // pattern itself).
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

  const mirrored = exportSettings.orientation === 'mirrored';

  const exportSvg = (): void => {
    const result = buildSvgPattern(regionMap, legend, {
      widthCm: safeDimensions.widthCm,
      heightCm: safeDimensions.heightCm,
      view: exportSettings.view,
      showGrid: false,
      showLabels: exportSettings.showLabels,
      mirrored,
      punchGuide,
    });
    downloadSvg(result.svg, withExtension('punch-relief-pattern', 'svg'));
  };

  const exportPng = async (): Promise<void> => {
    const result = buildSvgPattern(regionMap, legend, {
      widthCm: safeDimensions.widthCm,
      heightCm: safeDimensions.heightCm,
      view: exportSettings.view,
      showGrid: false,
      showLabels: exportSettings.showLabels,
      mirrored,
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
    view: exportSettings.view,
    showGrid: false,
    showLabels: exportSettings.showLabels,
    mirrored,
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

          <div className="field">
            <span id="export-view-label">Export pattern view</span>
            <div role="group" aria-labelledby="export-view-label" style={{ marginTop: 4 }}>
              {VIEWS.map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={exportSettings.view === v}
                  onClick={() => onExportSettingsChange({ view: v })}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <p className="helper-text">
            Applies to SVG/PNG export and printing -- "contour" prints outlines only, with no fill,
            for tracing.
          </p>

          <label>
            <input
              type="checkbox"
              checked={exportSettings.showLabels}
              onChange={(e) => onExportSettingsChange({ showLabels: e.target.checked })}
            />{' '}
            Print region labels (C1-H1 etc.)
          </label>
          <p className="helper-text">
            Turn off for an uncluttered print if you're reading colors/heights from the on-screen
            legend instead.
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
            Reopening a project restores settings, calibration, and colors -- if it was made from
            your own imported file (not a built-in sample), you'll need to re-select that file too,
            since the original model isn't embedded in the project JSON. See docs/DECISIONS.md.
          </p>

          <div ref={calibrationRef} tabIndex={-1}>
            <h3>Calibration</h3>
            <CalibrationEditor
              profile={calibrationProfile}
              savedProfiles={savedProfiles}
              onChange={onCalibrationChange}
              onSave={onCalibrationSave}
              onSelectSaved={onCalibrationSelect}
            />
          </div>
        </div>
      </details>

      {/* Hidden on screen; this is the only thing the print stylesheet
          leaves visible (see @media print in styles.css). "Print / Save as
          PDF" previously called window.print() against the controls above
          -- which never contained the pattern itself -- so a print/PDF was
          just the export form and calibration table, not the pattern.
          Each .print-page clips a full-size copy of the pattern image to
          that tile's region via a negative offset, so every page prints at
          true physical scale. */}
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
