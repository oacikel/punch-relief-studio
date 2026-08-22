import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeightStage } from '../HeightStage';
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
 * Iteration 03 Round 1 (docs/ITERATION_03_PLAN.md #6): calibration/
 * needle-setting UI was removed app-wide by explicit, reversible product
 * decision. HeightStage now shows plain height bands only -- no
 * "Needle setting" column, no "Calibrate needle settings" link, no
 * profile status line.
 */
describe('HeightStage', () => {
  it('shows a per-level share-of-pattern table with no needle-setting language', () => {
    const levels = makeLevels(2);
    render(
      <HeightStage
        levels={levels}
        heightIndex={Int16Array.from([0, 1, 0, 1])}
        width={2}
        height={2}
        minRegionPreset="balanced"
      />,
    );

    expect(screen.getByRole('columnheader', { name: 'Level' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Share of pattern' })).toBeInTheDocument();
    expect(screen.queryByText(/Needle setting/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Calibrate needle settings/)).not.toBeInTheDocument();
    expect(screen.queryByText(/uncalibrated/)).not.toBeInTheDocument();
  });

  it('shows the correct share for each level', () => {
    const levels = makeLevels(2);
    render(
      <HeightStage
        levels={levels}
        heightIndex={Int16Array.from([0, 1, 0, 1])}
        width={2}
        height={2}
        minRegionPreset="balanced"
      />,
    );

    expect(screen.getByRole('row', { name: /H1 50\.0%/ })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /H2 50\.0%/ })).toBeInTheDocument();
  });
});
