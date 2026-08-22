import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Legend } from '../Legend';
import type { LegendEntry } from '@/domain/pattern/legend';

const entries: LegendEntry[] = [
  {
    id: 'C1-H1',
    colorIndex: 0,
    heightIndex: 0,
    symbol: 'circle',
    color: '#8899aa',
    yarnName: 'Sky',
    needleSettingLabel: 'low',
    needleSettingNumber: 1,
    measuredHeightCm: null,
  },
];

/**
 * Iteration 03 Round 1 (docs/ITERATION_03_PLAN.md #6): needle-setting/
 * measured-height columns (and the "uncalibrated" banner referencing the
 * now-unreachable Calibration step) are removed. Region/Symbol/Yarn
 * color/Yarn name stay -- the Symbol column satisfies CLAUDE.md's "never
 * rely on color alone" rule, which is unrelated to calibration.
 */
describe('Legend', () => {
  it('renders one row per legend entry with its region ID, symbol, color, and yarn name', () => {
    render(<Legend entries={entries} />);
    expect(screen.getByText('C1-H1')).toBeInTheDocument();
    expect(screen.getByText('circle')).toBeInTheDocument();
    expect(screen.getByText('Sky')).toBeInTheDocument();
  });

  it('has no needle-setting or measured-height columns', () => {
    render(<Legend entries={entries} />);
    expect(screen.queryByRole('columnheader', { name: /Needle setting/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('columnheader', { name: /Measured height/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
