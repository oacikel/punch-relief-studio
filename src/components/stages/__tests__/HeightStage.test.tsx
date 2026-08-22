import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HeightStage } from '../HeightStage';
import { createDefaultProfile } from '@/domain/calibration';
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
 * Iteration 02 Stage B: HeightStage gains a contextual "Calibrate needle
 * settings" entry point (docs/ITERATION_02_PLAN.md §14 decision #1) --
 * calibration itself still lives on Preview, this stage just links to it.
 * HeightStage had no test file before Stage B; these tests cover both the
 * pre-existing per-level table and the new calibration link/status line.
 */
describe('HeightStage', () => {
  it('shows the profile name and an uncalibrated status for the default profile', () => {
    const levels = makeLevels(2);
    render(
      <HeightStage
        levels={levels}
        heightIndex={Int16Array.from([0, 1, 0, 1])}
        width={2}
        height={2}
        minRegionPreset="balanced"
        profile={createDefaultProfile()}
        onCalibrate={vi.fn()}
      />,
    );

    expect(screen.getByText(/Generic \(uncalibrated\)/)).toBeInTheDocument();
    expect(screen.getByText('not yet calibrated (relative order only)')).toBeInTheDocument();
  });

  it('shows a calibrated status once the profile has a measured height', () => {
    const levels = makeLevels(2);
    const profile = { ...createDefaultProfile(), calibrated: true };
    render(
      <HeightStage
        levels={levels}
        heightIndex={Int16Array.from([0, 1, 0, 1])}
        width={2}
        height={2}
        minRegionPreset="balanced"
        profile={profile}
        onCalibrate={vi.fn()}
      />,
    );

    expect(screen.getByText('calibrated')).toBeInTheDocument();
    expect(screen.queryByText('not yet calibrated (relative order only)')).not.toBeInTheDocument();
  });

  it('calls onCalibrate when "Calibrate needle settings" is clicked', async () => {
    const onCalibrate = vi.fn();
    const levels = makeLevels(2);
    render(
      <HeightStage
        levels={levels}
        heightIndex={Int16Array.from([0, 1, 0, 1])}
        width={2}
        height={2}
        minRegionPreset="balanced"
        profile={createDefaultProfile()}
        onCalibrate={onCalibrate}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Calibrate needle settings/ }));
    expect(onCalibrate).toHaveBeenCalledTimes(1);
  });
});
