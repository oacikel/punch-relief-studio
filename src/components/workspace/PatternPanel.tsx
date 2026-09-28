import { useState } from 'react';
import type { RegionMap } from '@/domain/types';
import type { LegendEntry } from '@/domain/pattern/legend';
import type { ContourSource, PatternView } from '@/export/svgPattern';
import { PatternCanvas } from '@/components/PatternCanvas';
import { DecimalNumberInput } from '@/components/DecimalNumberInput';
import {
  clampPunchGuideSpacingCm,
  type PunchGuideMode,
  type PunchGuideSettings,
} from '@/domain/pattern/punchGuide';

interface Props {
  regionMap: RegionMap;
  legend: LegendEntry[];
  widthCm: number;
  heightCm: number;
  view: PatternView;
  onViewChange: (view: PatternView) => void;
  showGrid: boolean;
  onShowGridChange: (show: boolean) => void;
  mirrored: boolean;
  onMirroredChange: (mirrored: boolean) => void;
  showOnScreenLabels: boolean;
  onShowOnScreenLabelsChange: (show: boolean) => void;
  punchGuide: PunchGuideSettings;
  onPunchGuideChange: (patch: Partial<PunchGuideSettings>) => void;
  contourSource?: ContourSource;
  isImageSource?: boolean;
}

const VIEW_LABELS: Record<PatternView, string> = {
  'color-only': 'Colors',
  'height-only': 'Heights',
  contour: 'Outline',
};

/**
 * "Pattern" panel -- the former Preview stage's pattern column, extracted
 * verbatim (view-mode row, Grid/Mirrored/Region-labels checkboxes,
 * punch-guide selector + spacing, the pattern canvas itself), now one of
 * the two always-visible panels in Workspace's sticky preview column
 * (Iteration 03's combined-workspace change -- docs/ITERATION_03_PLAN.md
 * #13). `view`/`showGrid`/`mirrored` are controlled props now (lifted to
 * `Workspace.tsx`, see docs/DECISIONS.md) rather than this component's own
 * local state, since `ExportPanel` -- a sibling in the rail, not a child
 * of this panel -- needs to read the same on-screen values.
 *
 * EXP-009: the canvas now sits right below the view-mode/zoom rows, bounded
 * to the column's available height by default (`PatternCanvas`'s `fit`
 * prop) so the whole pattern is visible without scrolling; the Grid/
 * Mirrored/Region-labels checkboxes, punch-guide selector/spacing, and
 * helper paragraph moved below the canvas so the pattern itself occupies
 * the top of the column. `fitMode` is local-only UI state (not lifted, not
 * persisted) -- purely a display choice, nothing else in the rail reads it.
 */
export function PatternPanel({
  regionMap,
  legend,
  widthCm,
  heightCm,
  view,
  onViewChange,
  showGrid,
  onShowGridChange,
  mirrored,
  onMirroredChange,
  showOnScreenLabels,
  onShowOnScreenLabelsChange,
  punchGuide,
  onPunchGuideChange,
  contourSource,
  isImageSource = false,
}: Props): JSX.Element {
  const views: PatternView[] = isImageSource
    ? ['color-only', 'contour']
    : ['color-only', 'height-only', 'contour'];
  // EXP-009: "Fit" bounds the canvas to the column's available height
  // (matches `.source-image-preview img`'s max-height + object-fit: contain
  // treatment) so the whole pattern is visible without scrolling; "Zoom in"
  // is the prior always-on full-width/full-magnification behavior, now a
  // deliberate choice rather than the default.
  const [fitMode, setFitMode] = useState<'fit' | 'zoom'>('fit');
  return (
    <div className="workspace-panel">
      <h3>Pattern</h3>
      <div role="group" aria-label="Pattern view" style={{ marginBottom: 8 }}>
        {views.map((v) => (
          <button key={v} type="button" aria-pressed={view === v} onClick={() => onViewChange(v)}>
            {VIEW_LABELS[v]}
          </button>
        ))}
      </div>
      <div role="group" aria-label="Pattern zoom" style={{ marginBottom: 8 }}>
        <button type="button" aria-pressed={fitMode === 'fit'} onClick={() => setFitMode('fit')}>
          Fit
        </button>
        <button type="button" aria-pressed={fitMode === 'zoom'} onClick={() => setFitMode('zoom')}>
          Zoom in
        </button>
      </div>
      <PatternCanvas
        regionMap={regionMap}
        legend={legend}
        view={view}
        widthCm={widthCm}
        heightCm={heightCm}
        showGrid={showGrid}
        showLabels={showOnScreenLabels}
        mirrored={mirrored}
        {...(contourSource ? { contourSource } : {})}
        punchGuide={punchGuide}
        fit={fitMode === 'fit'}
      />
      <label style={{ marginTop: 12, display: 'inline-block' }}>
        <input
          type="checkbox"
          checked={showGrid}
          onChange={(e) => onShowGridChange(e.target.checked)}
        />{' '}
        Grid
      </label>{' '}
      <label>
        <input
          type="checkbox"
          checked={mirrored}
          onChange={(e) => onMirroredChange(e.target.checked)}
        />{' '}
        Mirrored (back side)
      </label>{' '}
      <label>
        <input
          type="checkbox"
          checked={showOnScreenLabels}
          onChange={(e) => onShowOnScreenLabelsChange(e.target.checked)}
        />{' '}
        Region labels (C1-H1 etc.)
      </label>
      <div className="field" style={{ marginTop: 8 }}>
        <label htmlFor="punch-guide-mode">Punch guide</label>
        <select
          id="punch-guide-mode"
          value={punchGuide.mode}
          onChange={(e) => onPunchGuideChange({ mode: e.target.value as PunchGuideMode })}
        >
          <option value="none">None</option>
          <option value="dots">Dots</option>
        </select>
      </div>
      {punchGuide.mode === 'dots' && (
        <div className="field">
          <label htmlFor="punch-guide-spacing">Dot spacing (cm)</label>
          <DecimalNumberInput
            id="punch-guide-spacing"
            value={punchGuide.spacingCm}
            onChange={(spacingCm) =>
              onPunchGuideChange({ spacingCm: clampPunchGuideSpacingCm(spacingCm ?? NaN) })
            }
          />
        </div>
      )}
      <p className="helper-text">
        Adds evenly spaced dots across the pattern as a rough placement guide. This is the spacing
        you set here, not a measurement of your printer&apos;s actual output -- always check the
        printed scale-check square with a ruler before punching.
      </p>
    </div>
  );
}
