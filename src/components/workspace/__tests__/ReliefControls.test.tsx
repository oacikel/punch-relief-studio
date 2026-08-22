import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReliefControls } from '../ReliefControls';
import { DEFAULT_RELIEF_SETTINGS } from '@/domain/types';
import type { HeightLevel } from '@/domain/types';
import { normalizedDepth } from '@/domain/units';

function makeLevels(count: number): HeightLevel[] {
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    lowerBound: normalizedDepth(i / count),
    upperBound: normalizedDepth((i + 1) / count),
  }));
}

/**
 * Combined-workspace change (docs/ITERATION_03_PLAN.md #13): `ReliefControls`
 * replaces `ReliefStage` (Needle & pile / Punch detail / Shape
 * interpretation groups, no manual "Generate relief" button) and absorbs
 * `HeightStage`'s per-level coverage readout as live chips plus its
 * small-region warning (moved here, under "Punch detail" -- see
 * docs/DECISIONS.md).
 */
describe('ReliefControls', () => {
  it('renders the Basic controls with their accessible names, and no Generate button', () => {
    render(
      <ReliefControls
        settings={DEFAULT_RELIEF_SETTINGS}
        onChange={vi.fn()}
        levels={null}
        heightIndex={null}
        width={0}
        height={0}
      />,
    );

    expect(screen.getByLabelText(/Number of pile heights/)).toBeInTheDocument();
    expect(screen.getByLabelText('Relief depth')).toBeInTheDocument();
    expect(screen.getByLabelText('Smoothing')).toBeInTheDocument();
    expect(screen.getByLabelText('Smallest punchable region')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Raise near surfaces' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Generate relief/i })).not.toBeInTheDocument();
  });

  it('allows the full widened 2-12 height-level range', () => {
    render(
      <ReliefControls
        settings={DEFAULT_RELIEF_SETTINGS}
        onChange={vi.fn()}
        levels={null}
        heightIndex={null}
        width={0}
        height={0}
      />,
    );
    const slider = screen.getByLabelText(/Number of pile heights/) as HTMLInputElement;
    expect(slider.min).toBe('2');
    expect(slider.max).toBe('12');
  });

  it('keeps Advanced controls collapsed until their disclosure is opened', async () => {
    render(
      <ReliefControls
        settings={DEFAULT_RELIEF_SETTINGS}
        onChange={vi.fn()}
        levels={null}
        heightIndex={null}
        width={0}
        height={0}
      />,
    );
    expect(screen.getByLabelText('Height band spacing')).not.toBeVisible();
    await userEvent.click(screen.getByText('Advanced shape controls'));
    expect(screen.getByLabelText('Height band spacing')).toBeVisible();
  });

  it('shows no coverage chips before a relief has generated (levels is null)', () => {
    render(
      <ReliefControls
        settings={DEFAULT_RELIEF_SETTINGS}
        onChange={vi.fn()}
        levels={null}
        heightIndex={null}
        width={0}
        height={0}
      />,
    );
    expect(screen.queryByLabelText('Pile height coverage')).not.toBeInTheDocument();
  });

  it('shows a live coverage chip per level once a relief has generated', () => {
    const levels = makeLevels(2);
    render(
      <ReliefControls
        settings={DEFAULT_RELIEF_SETTINGS}
        onChange={vi.fn()}
        levels={levels}
        heightIndex={Int16Array.from([0, 1, 0, 1])}
        width={2}
        height={2}
      />,
    );
    expect(screen.getByText('H1 50.0%')).toBeInTheDocument();
    expect(screen.getByText('H2 50.0%')).toBeInTheDocument();
  });

  it('shows the small-region warning under Punch detail when tiny regions exist', () => {
    const levels = makeLevels(2);
    // A single isolated foreground pixel among a much larger canvas, with
    // an aggressive ('bold') min-region preset, should count as "too
    // small" and produce the warning -- 100x100 at 'bold' (0.08%) rounds
    // to an 8px threshold, safely above the 1px test region.
    const width = 100;
    const height = 100;
    const heightIndex = new Int16Array(width * height).fill(-1);
    heightIndex[0] = 0; // one isolated foreground pixel
    render(
      <ReliefControls
        settings={{ ...DEFAULT_RELIEF_SETTINGS, minRegionPreset: 'bold' }}
        onChange={vi.fn()}
        levels={levels}
        heightIndex={heightIndex}
        width={width}
        height={height}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/smaller than the minimum punchable size/);
  });

  it('has no "Detail resolution" control anywhere', () => {
    render(
      <ReliefControls
        settings={DEFAULT_RELIEF_SETTINGS}
        onChange={vi.fn()}
        levels={null}
        heightIndex={null}
        width={0}
        height={0}
      />,
    );
    expect(screen.queryByLabelText('Detail resolution')).not.toBeInTheDocument();
    expect(screen.queryByText('Advanced punch detail controls')).not.toBeInTheDocument();
  });
});
