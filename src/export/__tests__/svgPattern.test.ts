import { describe, expect, it } from 'vitest';
import { buildSvgPattern } from '../svgPattern';
import type { RegionMap } from '@/domain/types';
import type { LegendEntry } from '@/domain/pattern/legend';

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
    {
      id: 'C1-H2',
      colorIndex: 0,
      heightIndex: 1,
      symbol: 'triangle',
      color: '#445566',
      yarnName: 'Yarn 1',
      needleSettingLabel: 'medium-low',
      needleSettingNumber: 2,
      measuredHeightCm: null,
    },
  ];
}

describe('buildSvgPattern contour view', () => {
  it('draws a contour line at every height-level boundary', () => {
    // 4x1 grid: two H1 pixels then two H2 pixels -- one boundary.
    const regionMap: RegionMap = {
      width: 4,
      height: 1,
      heightIndex: Int16Array.from([0, 0, 1, 1]),
      colorIndex: Int16Array.from([0, 0, 0, 0]),
    };
    const result = buildSvgPattern(regionMap, makeLegend(), {
      widthCm: 4,
      heightCm: 1,
      view: 'contour',
      showGrid: false,
      showLabels: false,
      mirrored: false,
    });

    expect(result.svg).toContain('data-layer="contour"');
    // Region cells themselves must still be unfilled in contour view.
    expect(result.svg).toMatch(/fill="none" \/>/);
  });

  it('draws no contour layer when every pixel is the same height', () => {
    const regionMap: RegionMap = {
      width: 2,
      height: 1,
      heightIndex: Int16Array.from([0, 0]),
      colorIndex: Int16Array.from([0, 0]),
    };
    const result = buildSvgPattern(regionMap, makeLegend(), {
      widthCm: 2,
      heightCm: 1,
      view: 'contour',
      showGrid: false,
      showLabels: false,
      mirrored: false,
    });

    expect(result.svg).not.toContain('data-layer="contour"');
  });

  it('does not draw contour lines for non-contour views', () => {
    const regionMap: RegionMap = {
      width: 4,
      height: 1,
      heightIndex: Int16Array.from([0, 0, 1, 1]),
      colorIndex: Int16Array.from([0, 0, 0, 0]),
    };
    const result = buildSvgPattern(regionMap, makeLegend(), {
      widthCm: 4,
      heightCm: 1,
      view: 'combined',
      showGrid: false,
      showLabels: false,
      mirrored: false,
    });

    expect(result.svg).not.toContain('data-layer="contour"');
  });
});
