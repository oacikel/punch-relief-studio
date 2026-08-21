import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReliefStage } from '../ReliefStage';
import { DEFAULT_RELIEF_SETTINGS } from '@/domain/types';

/**
 * Iteration 02 Stage B: Relief-stage controls were renamed and grouped into
 * Basic/Advanced tiers per docs/ITERATION_02_PLAN.md §5. These tests cover
 * the new labels, the widened 2-12 level range, and that Advanced controls
 * stay behind a closed `<details>` by default.
 */
describe('ReliefStage (Iteration 02 Stage B labels/grouping)', () => {
  it('renders the renamed Basic controls with their new accessible names', () => {
    render(
      <ReliefStage
        settings={DEFAULT_RELIEF_SETTINGS}
        onChange={vi.fn()}
        onGenerate={vi.fn()}
        processing={false}
        error={null}
      />,
    );

    expect(screen.getByLabelText(/Number of pile heights/)).toBeInTheDocument();
    expect(screen.getByLabelText('Relief depth')).toBeInTheDocument();
    expect(screen.getByLabelText('Smoothing')).toBeInTheDocument();
    expect(screen.getByLabelText('Smallest punchable region')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Raise near surfaces' })).toBeInTheDocument();
  });

  it('allows the full widened 2-12 height-level range', () => {
    render(
      <ReliefStage
        settings={DEFAULT_RELIEF_SETTINGS}
        onChange={vi.fn()}
        onGenerate={vi.fn()}
        processing={false}
        error={null}
      />,
    );

    const slider = screen.getByLabelText(/Number of pile heights/) as HTMLInputElement;
    expect(slider.min).toBe('2');
    expect(slider.max).toBe('12');
  });

  it('keeps Advanced controls collapsed until their disclosure is opened', async () => {
    render(
      <ReliefStage
        settings={DEFAULT_RELIEF_SETTINGS}
        onChange={vi.fn()}
        onGenerate={vi.fn()}
        processing={false}
        error={null}
      />,
    );

    expect(screen.getByLabelText('Height band spacing')).not.toBeVisible();
    expect(screen.getByLabelText('Detail resolution')).not.toBeVisible();

    await userEvent.click(screen.getByText('Advanced shape controls'));
    expect(screen.getByLabelText('Height band spacing')).toBeVisible();

    await userEvent.click(screen.getByText('Advanced punch detail controls'));
    expect(screen.getByLabelText('Detail resolution')).toBeVisible();
  });
});
