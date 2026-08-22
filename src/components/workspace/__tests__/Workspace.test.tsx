import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Workspace } from '../Workspace';
import { DEFAULT_RELIEF_SETTINGS } from '@/domain/types';
import { createDefaultProfile } from '@/domain/calibration';
import { DEFAULT_PUNCH_GUIDE_SPACING_CM } from '@/domain/pattern/punchGuide';
import { ZERO_ROTATION } from '@/state/appState';

/**
 * Combined-workspace change (docs/ITERATION_03_PLAN.md #13). Scoped to the
 * "no relief generated yet" state only -- the "has result" branch renders
 * `SimulationPanel` -> `SimulationView`, which creates a real
 * `THREE.WebGLRenderer` with no WebGL context available in jsdom (matching
 * this project's existing convention of not unit-testing `Viewport3D`/
 * `SimulationView` directly -- both are exercised in e2e instead).
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
    processing: false,
    processingError: null,
  };
}

describe('Workspace', () => {
  it('shows the rail heading with a "Live" pill when idle', () => {
    render(<Workspace {...baseProps()} />);
    expect(screen.getByRole('heading', { name: 'Workspace' })).toBeInTheDocument();
    expect(screen.getByText(/Live — updates as you adjust/)).toBeInTheDocument();
  });

  it('shows a "Processing…" pill while a live generation is in flight', () => {
    render(<Workspace {...baseProps()} processing={true} />);
    expect(screen.getByText(/Processing…/)).toBeInTheDocument();
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
});
