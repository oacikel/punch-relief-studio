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

describe('Legend', () => {
  it('shows an uncalibrated warning when the profile is not calibrated', () => {
    render(<Legend entries={entries} calibrated={false} />);
    expect(screen.getByRole('status')).toHaveTextContent(/uncalibrated/i);
  });

  it('does not show the warning when calibrated', () => {
    render(<Legend entries={entries} calibrated={true} />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('renders one row per legend entry with its region ID', () => {
    render(<Legend entries={entries} calibrated={true} />);
    expect(screen.getByText('C1-H1')).toBeInTheDocument();
    expect(screen.getByText('Sky')).toBeInTheDocument();
  });
});
