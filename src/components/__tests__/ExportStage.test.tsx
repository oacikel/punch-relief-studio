import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportStage } from '../stages/ExportStage';
import { createDefaultProfile } from '@/domain/calibration';
import type { RegionMap } from '@/domain/types';
import type { LegendEntry } from '@/domain/pattern/legend';
import type { ExportSettings, PatternDimensions } from '@/state/appState';

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

const baseDimensions: PatternDimensions = { widthCm: 20, heightCm: 20, lockAspect: true };

function baseExportSettings(overrides: Partial<ExportSettings> = {}): ExportSettings {
  return { pageSize: 'a4', overlapCm: 1, orientation: 'front', view: 'combined', ...overrides };
}

describe('ExportStage print pages', () => {
  it('renders one .print-page per tile computeTiling produces, not just a single continuous document', () => {
    // A 30cm-wide pattern on A4 (printable width ~19cm) must tile across
    // more than one page -- this is exactly the case that was previously
    // invisible, since the export page never rendered the pattern at all.
    render(
      <ExportStage
        regionMap={makeRegionMap()}
        legend={makeLegend()}
        dimensions={{ ...baseDimensions, widthCm: 30, heightCm: 20 }}
        onDimensionsChange={vi.fn()}
        exportSettings={baseExportSettings()}
        onExportSettingsChange={vi.fn()}
        calibrationProfile={createDefaultProfile()}
        savedProfiles={[]}
        onCalibrationChange={vi.fn()}
        onCalibrationSave={vi.fn()}
        onCalibrationSelect={vi.fn()}
        onSaveProjectJson={vi.fn()}
        onLoadProjectJson={vi.fn()}
      />,
    );

    const pages = document.querySelectorAll('.print-page');
    expect(pages.length).toBeGreaterThan(1);
  });

  it('lets the user choose the pattern view used for export and print', async () => {
    const onExportSettingsChange = vi.fn();
    render(
      <ExportStage
        regionMap={makeRegionMap()}
        legend={makeLegend()}
        dimensions={baseDimensions}
        onDimensionsChange={vi.fn()}
        exportSettings={baseExportSettings()}
        onExportSettingsChange={onExportSettingsChange}
        calibrationProfile={createDefaultProfile()}
        savedProfiles={[]}
        onCalibrationChange={vi.fn()}
        onCalibrationSave={vi.fn()}
        onCalibrationSelect={vi.fn()}
        onSaveProjectJson={vi.fn()}
        onLoadProjectJson={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'contour' }));
    expect(onExportSettingsChange).toHaveBeenCalledWith({ view: 'contour' });
  });
});
