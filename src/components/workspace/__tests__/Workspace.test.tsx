import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    undoPaletteName: null,
    onUndoPalette: vi.fn(),
    canResetColors: false,
    onResetColors: vi.fn(),
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
      view: 'color-only' as const,
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
    imageDetailSettings: { preserveSmallDetails: true },
    onImageDetailSettingsChange: vi.fn(),
    processing: false,
    processingError: null,
  };
}

describe('Workspace', () => {
  it('offers the small-detail rescue control for image sources', async () => {
    const props = baseProps();
    render(<Workspace {...props} isImageSource={true} />);
    const control = screen.getByRole('checkbox', { name: 'Keep tiny symbols and thin lines' });
    expect(control).toBeChecked();
    await userEvent.click(control);
    expect(props.onImageDetailSettingsChange).toHaveBeenCalledWith({
      preserveSmallDetails: false,
    });
  });

  it('shows the rail heading with no status pill when idle', () => {
    render(<Workspace {...baseProps()} />);
    expect(screen.getByRole('heading', { name: 'Make it punchable' })).toBeInTheDocument();
    expect(screen.queryByText(/Processing…/)).not.toBeInTheDocument();
  });

  it('does not show the first-project guide by default', () => {
    render(<Workspace {...baseProps()} />);
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('shows the first-project guide when requested, and dismisses it via the callback', async () => {
    const onDismissFirstProjectGuide = vi.fn();
    render(
      <Workspace
        {...baseProps()}
        showFirstProjectGuide={true}
        onDismissFirstProjectGuide={onDismissFirstProjectGuide}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'Three short steps to your first pattern' }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(onDismissFirstProjectGuide).toHaveBeenCalledTimes(1);
  });

  it('shows a "Processing…" pill while a live generation is in flight', () => {
    render(<Workspace {...baseProps()} processing={true} />);
    expect(screen.getAllByText(/Processing…/).length).toBeGreaterThan(0);
  });

  it('shows the processing error banner when present', () => {
    render(<Workspace {...baseProps()} processingError="Something went wrong." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong.');
  });

  it('shows one setup step at a time instead of every control group at once', async () => {
    render(<Workspace {...baseProps()} />);
    expect(screen.getByRole('heading', { name: 'Shape the relief' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Choose your yarn' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '2 Yarn' }));
    expect(screen.getByRole('heading', { name: 'Choose your yarn' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Shape the relief' })).not.toBeInTheDocument();
  });

  it('shows clear generating and export placeholders before the first relief generates', async () => {
    render(<Workspace {...baseProps()} />);
    expect(screen.getByText(/Generating your first relief/)).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Pattern view' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '3 Export' }));
    expect(screen.getByText(/Export options will appear as soon as/)).toBeInTheDocument();
  });

  it('has no rail jump-nav anywhere (removed in the Workspace two-column redesign)', () => {
    render(<Workspace {...baseProps()} />);
    expect(
      screen.queryByRole('navigation', { name: 'Jump to rail section' }),
    ).not.toBeInTheDocument();
  });

  describe('EXP-002: move yarn palette selection earlier', () => {
    it('defaults to Shape-then-Yarn (control) when the prop is omitted', () => {
      render(<Workspace {...baseProps()} />);
      expect(screen.getByRole('button', { name: '1 Shape' })).toHaveAttribute(
        'aria-current',
        'step',
      );
      expect(screen.getByRole('button', { name: '2 Yarn' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Shape the relief' })).toBeInTheDocument();
    });

    it('opens on Yarn-then-Shape when enrolled in the earlier variant', async () => {
      render(<Workspace {...baseProps()} moveYarnColorsEarlier={true} />);
      expect(screen.getByRole('button', { name: '1 Yarn' })).toHaveAttribute(
        'aria-current',
        'step',
      );
      expect(screen.getByRole('heading', { name: 'Choose your yarn' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Shape the relief' })).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: '2 Shape' }));
      expect(screen.getByRole('heading', { name: 'Shape the relief' })).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: '3 Export' }));
      expect(screen.getByText(/Export options will appear as soon as/)).toBeInTheDocument();
    });
  });

  describe('EXP-011: express lane (one screen from import to export)', () => {
    it('defaults to the gated rail when the prop is omitted', () => {
      render(<Workspace {...baseProps()} />);
      expect(screen.queryByRole('navigation', { name: 'Pattern setup steps' })).toBeInTheDocument();
    });

    it('renders Shape, Yarn and the export placeholder together, with no step nav or Back/Continue', () => {
      render(<Workspace {...baseProps()} expressLane={true} />);

      expect(
        screen.queryByRole('navigation', { name: 'Pattern setup steps' }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Back/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Continue to/ })).not.toBeInTheDocument();

      expect(screen.getByRole('heading', { name: 'Shape the relief' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Choose your yarn' })).toBeInTheDocument();
      expect(screen.getByText(/Export options will appear as soon as/)).toBeInTheDocument();
    });

    it('shows the export panel immediately once a result exists, with no click required', () => {
      render(<Workspace {...readyProps()} expressLane={true} />);

      expect(screen.getByRole('heading', { name: 'Shape the relief' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Choose your yarn' })).toBeInTheDocument();
      expect(screen.getByText('Export & print')).toBeInTheDocument();
    });
  });

  describe('EXP-012: one-click pattern recipes jump straight to Export', () => {
    it('ignores initialEditorStep and keeps the Shape-first default when omitted', () => {
      render(<Workspace {...baseProps()} />);
      expect(screen.getByRole('button', { name: '1 Shape' })).toHaveAttribute(
        'aria-current',
        'step',
      );
      expect(screen.getByRole('heading', { name: 'Shape the relief' })).toBeInTheDocument();
    });

    it("opens directly on the gated rail's Export step when a recipe just applied", () => {
      render(<Workspace {...baseProps()} initialEditorStep="export" />);
      expect(screen.getByRole('button', { name: '3 Export' })).toHaveAttribute(
        'aria-current',
        'step',
      );
      expect(screen.queryByRole('heading', { name: 'Shape the relief' })).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Choose your yarn' })).not.toBeInTheDocument();
      expect(screen.getByText(/Export options will appear as soon as/)).toBeInTheDocument();
    });

    it('still lets the maker step back to Shape/Yarn after landing on Export', async () => {
      render(<Workspace {...baseProps()} initialEditorStep="export" />);
      await userEvent.click(screen.getByRole('button', { name: '1 Shape' }));
      expect(screen.getByRole('heading', { name: 'Shape the relief' })).toBeInTheDocument();
    });

    it('shows the real export panel immediately once a result already exists', () => {
      render(<Workspace {...readyProps()} initialEditorStep="export" />);
      expect(screen.getByText('Export & print')).toBeInTheDocument();
    });
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
    const simulationTab = screen.getByRole('button', { name: 'Textile preview' });
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
