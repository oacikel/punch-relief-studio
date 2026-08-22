import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PatternPanel } from '../PatternPanel';
import type { RegionMap } from '@/domain/types';
import type { LegendEntry } from '@/domain/pattern/legend';
import { DEFAULT_PUNCH_GUIDE_SPACING_CM } from '@/domain/pattern/punchGuide';

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

function baseProps() {
  return {
    regionMap: makeRegionMap(),
    legend: makeLegend(),
    widthCm: 20,
    heightCm: 20,
    view: 'combined' as const,
    onViewChange: vi.fn(),
    showGrid: false,
    onShowGridChange: vi.fn(),
    mirrored: false,
    onMirroredChange: vi.fn(),
    showOnScreenLabels: true,
    onShowOnScreenLabelsChange: vi.fn(),
    punchGuide: { mode: 'none' as const, spacingCm: DEFAULT_PUNCH_GUIDE_SPACING_CM },
    onPunchGuideChange: vi.fn(),
  };
}

/** Combined-workspace change (docs/ITERATION_03_PLAN.md #13):
 * `PatternPanel` is the former Preview stage's pattern column, extracted
 * verbatim, now controlled by props (view/showGrid/mirrored lifted to
 * `Workspace.tsx` so `ExportPanel`, a rail sibling, can read them too --
 * see docs/DECISIONS.md). */
describe('PatternPanel', () => {
  it('renders the view-mode row, grid/mirrored/labels checkboxes, and punch-guide selector', () => {
    render(<PatternPanel {...baseProps()} />);
    expect(screen.getByRole('group', { name: 'Pattern view' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Grid' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Mirrored (back side)' })).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: 'Region labels (C1-H1 etc.)' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Punch guide')).toBeInTheDocument();
  });

  it('calls onViewChange when a view-mode button is clicked', async () => {
    const onViewChange = vi.fn();
    render(<PatternPanel {...baseProps()} onViewChange={onViewChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'contour' }));
    expect(onViewChange).toHaveBeenCalledWith('contour');
  });

  it('reveals the spacing input only when the punch guide mode is "dots"', () => {
    const { rerender } = render(<PatternPanel {...baseProps()} />);
    expect(screen.queryByLabelText('Dot spacing (cm)')).not.toBeInTheDocument();

    rerender(
      <PatternPanel
        {...baseProps()}
        punchGuide={{ mode: 'dots', spacingCm: DEFAULT_PUNCH_GUIDE_SPACING_CM }}
      />,
    );
    expect(screen.getByLabelText('Dot spacing (cm)')).toBeInTheDocument();
  });
});
