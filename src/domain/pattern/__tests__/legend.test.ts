import { describe, expect, it } from 'vitest';
import { buildLegend } from '../legend';
import { createDefaultProfile } from '../../calibration';
import type { HeightLevel, RegionMap } from '../../types';

function level(index: number): HeightLevel {
  return { index, lowerBound: 0 as never, upperBound: 1 as never };
}

describe('buildLegend', () => {
  it('only lists (color, height) combinations that actually occur in the region map', () => {
    // Two swatches, three height levels declared, but only H1 (with C1) and
    // H3 (with C2) actually have any pixels -- H2 is empty.
    const regionMap: RegionMap = {
      width: 2,
      height: 1,
      heightIndex: Int16Array.from([0, 2]),
      colorIndex: Int16Array.from([0, 1]),
    };
    const swatches = [
      { index: 0, color: { r: 1, g: 2, b: 3 }, yarnName: 'Yarn 1' },
      { index: 1, color: { r: 4, g: 5, b: 6 }, yarnName: 'Yarn 2' },
    ];
    const levels = [level(0), level(1), level(2)];
    const legend = buildLegend(swatches, levels, createDefaultProfile(), regionMap);

    expect(legend.map((e) => e.id).sort()).toEqual(['C1-H1', 'C2-H3']);
  });

  it('never lists a color/height pairing that color-by-height mode cannot produce', () => {
    // color-by-height mode always sets colorIndex === heightIndex, so a
    // region map built that way should never yield a cross-mismatched
    // entry like "C2-H1".
    const regionMap: RegionMap = {
      width: 4,
      height: 1,
      heightIndex: Int16Array.from([0, 1, -1, 1]),
      colorIndex: Int16Array.from([0, 1, -1, 1]),
    };
    const swatches = [
      { index: 0, color: { r: 1, g: 2, b: 3 }, yarnName: 'Yarn 1' },
      { index: 1, color: { r: 4, g: 5, b: 6 }, yarnName: 'Yarn 2' },
    ];
    const levels = [level(0), level(1)];
    const legend = buildLegend(swatches, levels, createDefaultProfile(), regionMap);

    expect(legend.map((e) => e.id).sort()).toEqual(['C1-H1', 'C2-H2']);
  });

  it('returns no entries for an all-background region map', () => {
    const regionMap: RegionMap = {
      width: 2,
      height: 1,
      heightIndex: Int16Array.from([-1, -1]),
      colorIndex: Int16Array.from([-1, -1]),
    };
    const swatches = [{ index: 0, color: { r: 1, g: 2, b: 3 }, yarnName: 'Yarn 1' }];
    const legend = buildLegend(swatches, [level(0)], createDefaultProfile(), regionMap);

    expect(legend).toHaveLength(0);
  });
});
