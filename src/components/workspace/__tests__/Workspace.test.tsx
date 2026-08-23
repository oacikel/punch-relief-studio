import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Workspace } from '../Workspace';
import { DEFAULT_RELIEF_SETTINGS } from '@/domain/types';
import type { RegionMap, HeightLevel } from '@/domain/types';
import type { LegendEntry } from '@/domain/pattern/legend';
import { createDefaultProfile } from '@/domain/calibration';
import { normalizedDepth } from '@/domain/units';
import { DEFAULT_PUNCH_GUIDE_SPACING_CM } from '@/domain/pattern/punchGuide';
import { ZERO_ROTATION } from '@/state/appState';

/**
 * Combined-workspace change (docs/ITERATION_03_PLAN.md #13), reworked again
 * by the Workspace two-column redesign (true 50/50 split, tab-switch
 * preview -- see docs/DECISIONS.md). Most tests here are scoped to the "no
 * relief generated yet" state -- the "has result" branch, when the
 * Finished-piece simulation tab is active, renders `SimulationPanel` ->
 * `SimulationView`, which creates a real `THREE.WebGLRenderer` with no
 * WebGL context available in jsdom (matching this project's existing
 * convention of not unit-testing `Viewport3D`/`SimulationView` directly --
 * both are exercised in e2e instead). The "ready state" tests below
 * exercise the "has result" branch, but deliberately never click into the
 * Finished-piece simulation tab -- only the default Pattern tab, which
 * doesn't touch Three.js at all -- so they stay safely inside jsdom's
 * capability. Full tab-switch coverage (including the Simulation tab) is
 * in e2e/workspace.spec.ts.
 */
function baseProps() {
  return {
    reliefSettings: DEFAULT_RELIEF_SETTINGS,
    onReliefSettingsChange: vi.fn(),
    processed: null,
    regionMap: null,
    legend: [],
    colorMode: 'single' as const,
    swatches: [{ index: 0, color: { r: 139, g: 90, b: 60 }, yarnName: 'Yarn 1' }],
    paletteSize: 4,
    hasSourceColor: false,
    onColorModeChange: vi.fn(),
    onSwatchesChange: vi.fn(),
    onPaletteSizeChange: vi.fn(),
    onApplyPalette: vi.fn(),
    profile: createDefaultProfile(),
    dimensions: { widthCm: 20, heightCm: 20, lockAspect: true },
    onDimensionsChange: vi.fn(),
    renderSettings: {
      pileStyle: 'loop' as const,
      density: 0.6,
      yarnThickness: 0.5,
      fabricColorHex: '#e8ddc8',
      lightingAzimuthDeg: 45,
      lightingElevationDeg: 55,
    },
    onRenderSettingsChange: vi.fn(),
    exportSettings: {
      pageSize: 'a4' as const,
      overlapCm: 1,
      orientation: 'front' as const,
      view: 'combined' as const,
      showLabels: true,
    },
    onExportSettingsChange: vi.fn(),
    onSaveProjectJson: vi.fn(),
    onLoadProjectJson: vi.fn(),
    patternViewSettings: {
      showOnScreenLabels: true,
      punchGuide: { mode: 'none' as const, spacingCm: DEFAULT_PUNCH_GUIDE_SPACING_CM },
    },
    onPatternViewSettingsChange: vi.fn(),
    rotationDeg: ZERO_ROTATION,
    onRotationChange: vi.fn(),
    needleGeometry: { diameterMm: 0, throwMm: 0 },
    onNeedleGeometryChange: vi.fn(),
    processing: false,
    processingError: null,
  };
}

describe('Workspace', () => {
  it('shows the rail heading with no status pill when idle', () => {
    render(<Workspace {...baseProps()} />);
    expect(screen.getByRole('heading', { name: 'Workspace' })).toBeInTheDocument();
    expect(screen.queryByText(/Processing…/)).not.toBeInTheDocument();
  });

  it('shows a "Processing…" pill while a live generation is in flight', () => {
    render(<Workspace {...baseProps()} processing={true} />);
    expect(screen.getAllByText(/Processing…/).length).toBeGreaterThan(0);
  });

  it('shows the processing error banner when present', () => {
    render(<Workspace {...baseProps()} processingError="Something went wrong." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong.');
  });

  it('renders the rail control groups even before the first relief has generated', () => {
    render(<Workspace {...baseProps()} />);
    expect(screen.getByRole('heading', { name: 'Needle & pile' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Punch detail' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Shape interpretation' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Yarn colors' })).toBeInTheDocument();
  });

  it('shows placeholders for the preview panels and export panel before the first relief generates', () => {
    render(<Workspace {...baseProps()} />);
    expect(screen.getByText(/Generating your first relief/)).toBeInTheDocument();
    expect(
      screen.getByText(/Export & print will be available once the first relief has generated/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Pattern view' })).not.toBeInTheDocument();
  });

  it('has no rail jump-nav anywhere (removed in the Workspace two-column redesign)', () => {
    render(<Workspace {...baseProps()} />);
    expect(
      screen.queryByRole('navigation', { name: 'Jump to rail section' }),
    ).not.toBeInTheDocument();
  });
});

function makeRegionMap(): RegionMap {
  return {
    width: 2,
    height: 2,
    heightIndex: Int16Array.from([0, 1, 0, 1]),
    colorIndex: Int16Array.from([0, 0, 0, 0]),
  };
}

function makeLevels(): HeightLevel[] {
  return [
    { index: 0, lowerBound: normalizedDepth(0), upperBound: normalizedDepth(0.5) },
    { index: 1, lowerBound: normalizedDepth(0.5), upperBound: normalizedDepth(1) },
  ];
}

function makeLegend(): LegendEntry[] {
  return [0, 1].map((h) => ({
    id: `C1-H${h + 1}`,
    colorIndex: 0,
    heightIndex: h,
    symbol: 'circle',
    color: '#112233',
    yarnName: `Yarn ${h + 1}`,
    needleSettingLabel: 'low',
    needleSettingNumber: h + 1,
    measuredHeightCm: null,
  }));
}

function readyProps() {
  return {
    ...baseProps(),
    processed: {
      levels: makeLevels(),
      heightIndex: makeRegionMap().heightIndex,
      width: 2,
      height: 2,
    },
    regionMap: makeRegionMap(),
    legend: makeLegend(),
  };
}

/**
 * Workspace two-column redesign: the preview column shows a tab switch
 * (Pattern / Finished-piece simulation), not stacked panels -- the direct
 * fix for the product owner's core complaint ("I don't see that there's a
 * live finished-piece simulation without scrolling down"). These tests
 * exercise the "ready" (post-first-generation) state but never click into
 * the Simulation tab -- see the file-level doc comment for why.
 */
describe('Workspace (ready state, preview tab switch)', () => {
  it('shows the Pattern tab active by default, with the Finished-piece simulation tab NOT mounted', () => {
    render(<Workspace {...readyProps()} />);

    const patternTab = screen.getByRole('button', { name: 'Pattern' });
    const simulationTab = screen.getByRole('button', {
      name: 'Finished-piece simulation',
    });
    expect(patternTab).toHaveAttribute('aria-pressed', 'true');
    expect(simulationTab).toHaveAttribute('aria-pressed', 'false');

    // The Pattern tab's own content is visible...
    expect(screen.getByRole('group', { name: 'Pattern view' })).toBeInTheDocument();
    // ...and the Simulation tab's content (SimulationView, which would
    // require a real WebGL context) is genuinely not in the DOM, not just
    // visually hidden -- a real conditional render, not CSS-hidden panels.
    expect(screen.queryByLabelText('Finished-piece simulation')).not.toBeInTheDocument();
  });

  it('has no Legend section anywhere (removed in the Workspace two-column redesign)', () => {
    render(<Workspace {...readyProps()} />);
    expect(screen.queryByRole('heading', { name: 'Legend' })).not.toBeInTheDocument();
  });

  it('shows a regenerating overlay over the preview panel while processing, hidden when idle', () => {
    const { rerender } = render(<Workspace {...readyProps()} processing={false} />);
    expect(screen.queryByText('Regenerating…')).not.toBeInTheDocument();

    rerender(<Workspace {...readyProps()} processing={true} />);
    expect(screen.getByText('Regenerating…')).toBeInTheDocument();
  });

  // Deliberately NOT tested here: clicking the "Finished-piece simulation"
  // tab button. Doing so would mount `SimulationPanel` -> `SimulationView`,
  // which constructs a real `THREE.WebGLRenderer` -- no WebGL context is
  // available in jsdom, matching this project's existing convention (see
  // the file-level doc comment). That interaction is covered in
  // e2e/workspace.spec.ts instead, against a real browser.
});
