import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExportPanel } from '../ExportPanel';
import * as usePatternSvgUrlModule from '@/hooks/usePatternSvgUrl';
import type { RegionMap } from '@/domain/types';
import type { LegendEntry } from '@/domain/pattern/legend';
import type { ExportSettings, PatternDimensions, PunchGuideSettings } from '@/state/appState';

function makeRegionMap(): RegionMap {
  return {
    width: 2,
    height: 2,
    heightIndex: Int16Array.from([0, 0, 0, 0]),
    colorIndex: Int16Array.from([0, 0, 0, 0]),
  };
}

function makeLegend(): LegendEntry[] {
  return [
    {
      id: 'C1-H1',
      colorIndex: 0,
      heightIndex: 0,
      symbol: 'circle',
      color: '#112233',
      yarnName: 'Yarn 1',
      needleSettingLabel: 'low',
      needleSettingNumber: 1,
      measuredHeightCm: null,
    },
  ];
}

const baseDimensions: PatternDimensions = { widthCm: 20, heightCm: 20, lockAspect: true };

function baseExportSettings(overrides: Partial<ExportSettings> = {}): ExportSettings {
  return {
    pageSize: 'a4',
    overlapCm: 1,
    orientation: 'front',
    view: 'combined',
    showLabels: true,
    ...overrides,
  };
}

function basePunchGuide(overrides: Partial<PunchGuideSettings> = {}): PunchGuideSettings {
  return { mode: 'none', spacingCm: 1, ...overrides };
}

/** Baseline props matching Preview's default on-screen state
 * (view=combined, grid off, not mirrored, labels on) -- see
 * docs/ITERATION_03_PLAN.md #11: ExportPanel no longer owns its own
 * view/label controls, it reads Preview's current on-screen state
 * directly via these props. */
function baseScreenProps(): {
  screenView: 'combined';
  screenShowGrid: boolean;
  screenMirrored: boolean;
  screenShowLabels: boolean;
} {
  return {
    screenView: 'combined',
    screenShowGrid: false,
    screenMirrored: false,
    screenShowLabels: true,
  };
}

describe('ExportPanel print pages', () => {
  it('renders one .print-page per tile computeTiling produces, not just a single continuous document', () => {
    // A 30cm-wide pattern on A4 (printable width ~19cm) must tile across
    // more than one page -- this is exactly the case that was previously
    // invisible, since the export page never rendered the pattern at all.
    render(
      <ExportPanel
        regionMap={makeRegionMap()}
        legend={makeLegend()}
        dimensions={{ ...baseDimensions, widthCm: 30, heightCm: 20 }}
        onDimensionsChange={vi.fn()}
        exportSettings={baseExportSettings()}
        onExportSettingsChange={vi.fn()}
        onSaveProjectJson={vi.fn()}
        onLoadProjectJson={vi.fn()}
        punchGuide={basePunchGuide()}
        {...baseScreenProps()}
      />,
    );

    const pages = document.querySelectorAll('.print-page');
    expect(pages.length).toBeGreaterThan(1);
  });

  it('renders exactly one print page for "actual-size" without crashing (Iteration 02 Stage D regression)', () => {
    // Stage D verification found that selecting "Actual project size"
    // crashed the whole app: `computeTiling` calls `getPageDimensionsCm`
    // unconditionally before its own single-page fast path, and that
    // throws for pageSize "actual-size" unless `actualSizeCm` is supplied
    // -- this call site never passed it. Reproduced live via a headless
    // Chromium session (selecting the option surfaced the top-level
    // ErrorBoundary's "Something went wrong" with the exact thrown
    // message), fixed in ExportPanel.tsx by always passing the pattern's
    // own dimensions as `actualSizeCm`.
    render(
      <ExportPanel
        regionMap={makeRegionMap()}
        legend={makeLegend()}
        dimensions={{ ...baseDimensions, widthCm: 30, heightCm: 20 }}
        onDimensionsChange={vi.fn()}
        exportSettings={baseExportSettings({ pageSize: 'actual-size' })}
        onExportSettingsChange={vi.fn()}
        onSaveProjectJson={vi.fn()}
        onLoadProjectJson={vi.fn()}
        punchGuide={basePunchGuide()}
        {...baseScreenProps()}
      />,
    );

    const pages = document.querySelectorAll('.print-page');
    expect(pages).toHaveLength(1);
  });

  it('renders exactly one print page for a tiny "actual-size" pattern (deeper Stage D regression)', () => {
    // A second, deeper crash the same investigation found: a small
    // actual-size pattern (here 1cm x 1cm) used to still throw --
    // computeTiling validated overlap against a margin-derived printable
    // area unconditionally, even for 'actual-size', where that check
    // doesn't apply at all. Fixed in printTiling.ts by short-circuiting
    // on pageSize before that validation. Reproduced live: Width=1cm,
    // Height=1cm, "Actual project size" crashed the app with "overlap is
    // too large for the printable page area".
    render(
      <ExportPanel
        regionMap={makeRegionMap()}
        legend={makeLegend()}
        dimensions={{ ...baseDimensions, widthCm: 1, heightCm: 1 }}
        onDimensionsChange={vi.fn()}
        exportSettings={baseExportSettings({ pageSize: 'actual-size' })}
        onExportSettingsChange={vi.fn()}
        onSaveProjectJson={vi.fn()}
        onLoadProjectJson={vi.fn()}
        punchGuide={basePunchGuide()}
        {...baseScreenProps()}
      />,
    );

    const pages = document.querySelectorAll('.print-page');
    expect(pages).toHaveLength(1);
  });
});

/**
 * Iteration 03 Round 1 (docs/ITERATION_03_PLAN.md #11): ExportPanel no
 * longer has its own "Export pattern view" selector or "Print region
 * labels" checkbox -- it reads Preview's current on-screen state
 * directly via the screenView/screenShowGrid/screenMirrored/
 * screenShowLabels props instead. This is a full reversal of the Stage C
 * decision that let screen and print settings diverge (docs/DECISIONS.md).
 */
describe('ExportPanel reads on-screen state, no duplicate controls', () => {
  it('has no "Export pattern view" control or "Print region labels" checkbox of its own', () => {
    render(
      <ExportPanel
        regionMap={makeRegionMap()}
        legend={makeLegend()}
        dimensions={baseDimensions}
        onDimensionsChange={vi.fn()}
        exportSettings={baseExportSettings()}
        onExportSettingsChange={vi.fn()}
        onSaveProjectJson={vi.fn()}
        onLoadProjectJson={vi.fn()}
        punchGuide={basePunchGuide()}
        {...baseScreenProps()}
      />,
    );

    expect(screen.queryByText('Export pattern view')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', { name: /Print region labels/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'contour' })).not.toBeInTheDocument();
  });

  it('passes the on-screen view/grid/mirrored/labels state into the print-image SVG build', () => {
    const spy = vi.spyOn(usePatternSvgUrlModule, 'usePatternSvgUrl');
    render(
      <ExportPanel
        regionMap={makeRegionMap()}
        legend={makeLegend()}
        dimensions={baseDimensions}
        onDimensionsChange={vi.fn()}
        exportSettings={baseExportSettings()}
        onExportSettingsChange={vi.fn()}
        onSaveProjectJson={vi.fn()}
        onLoadProjectJson={vi.fn()}
        punchGuide={basePunchGuide()}
        screenView="contour"
        screenShowGrid={true}
        screenMirrored={true}
        screenShowLabels={false}
      />,
    );

    expect(spy).toHaveBeenCalled();
    const printCallOptions = spy.mock.calls.at(-1)?.[2];
    expect(printCallOptions?.view).toBe('contour');
    expect(printCallOptions?.showGrid).toBe(true);
    expect(printCallOptions?.mirrored).toBe(true);
    expect(printCallOptions?.showLabels).toBe(false);
    spy.mockRestore();
  });
});

describe('ExportPanel punch guide (Iteration 02 Stage C)', () => {
  it('renders without crashing when a "dots" punch guide is active, at any spacing', () => {
    render(
      <ExportPanel
        regionMap={makeRegionMap()}
        legend={makeLegend()}
        dimensions={baseDimensions}
        onDimensionsChange={vi.fn()}
        exportSettings={baseExportSettings()}
        onExportSettingsChange={vi.fn()}
        onSaveProjectJson={vi.fn()}
        onLoadProjectJson={vi.fn()}
        punchGuide={basePunchGuide({ mode: 'dots', spacingCm: 0.5 })}
        {...baseScreenProps()}
      />,
    );

    // The punch guide has no dedicated UI inside ExportPanel itself (the
    // selector/spacing controls live on PreviewStage, shared down as a
    // prop) -- this just confirms passing an active guide through to the
    // export/print SVG-building calls doesn't throw or otherwise break
    // the panel's own rendering.
    expect(document.querySelector('.export-panel')).toBeInTheDocument();
  });

  /**
   * Iteration 02 Stage D: the test above only proves the panel doesn't
   * crash with an active punch guide -- it doesn't prove the *print* path
   * (the hidden `.print-pages` block, built via `usePatternSvgUrl`) is
   * what actually receives the setting, as opposed to only the on-click
   * "Export SVG"/"Export PNG" button handlers (which call
   * `buildSvgPattern` directly and are not exercised by just rendering).
   * Spies on the real `usePatternSvgUrl` implementation (wrapping it, not
   * replacing it, so the panel keeps rendering real pattern images) to
   * assert the one call ExportPanel makes on render -- for the print
   * image -- is given the exact `punchGuide` prop it was passed.
   */
  it('threads the punchGuide prop into the print-image SVG build (usePatternSvgUrl), not just the export buttons', () => {
    const spy = vi.spyOn(usePatternSvgUrlModule, 'usePatternSvgUrl');
    const dotsGuide = basePunchGuide({ mode: 'dots', spacingCm: 0.5 });
    render(
      <ExportPanel
        regionMap={makeRegionMap()}
        legend={makeLegend()}
        dimensions={baseDimensions}
        onDimensionsChange={vi.fn()}
        exportSettings={baseExportSettings()}
        onExportSettingsChange={vi.fn()}
        onSaveProjectJson={vi.fn()}
        onLoadProjectJson={vi.fn()}
        punchGuide={dotsGuide}
        {...baseScreenProps()}
      />,
    );

    expect(spy).toHaveBeenCalled();
    const printCallOptions = spy.mock.calls.at(-1)?.[2];
    expect(printCallOptions?.punchGuide).toEqual(dotsGuide);
    spy.mockRestore();
  });
});
