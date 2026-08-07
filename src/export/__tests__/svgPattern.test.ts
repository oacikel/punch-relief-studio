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

describe('buildSvgPattern region labels', () => {
  it('labels a large-enough region with its C{n}-H{n} id, even in contour view', () => {
    // 10x10, all one region -- well above the minimum labeled area.
    const regionMap: RegionMap = {
      width: 10,
      height: 10,
      heightIndex: new Int16Array(100).fill(0),
      colorIndex: new Int16Array(100).fill(0),
    };
    const combined = buildSvgPattern(regionMap, makeLegend(), {
      widthCm: 10,
      heightCm: 10,
      view: 'combined',
      showGrid: false,
      showLabels: true,
      mirrored: false,
    });
    expect(combined.svg).toContain('data-layer="labels"');
    expect(combined.svg).toContain('>C1-H1<');

    const contour = buildSvgPattern(regionMap, makeLegend(), {
      widthCm: 10,
      heightCm: 10,
      view: 'contour',
      showGrid: false,
      showLabels: true,
      mirrored: false,
    });
    expect(contour.svg).toContain('data-layer="labels"');
    expect(contour.svg).toContain('>C1-H1<');
  });

  it('omits labels entirely when showLabels is false', () => {
    const regionMap: RegionMap = {
      width: 10,
      height: 10,
      heightIndex: new Int16Array(100).fill(0),
      colorIndex: new Int16Array(100).fill(0),
    };
    const result = buildSvgPattern(regionMap, makeLegend(), {
      widthCm: 10,
      heightCm: 10,
      view: 'combined',
      showGrid: false,
      showLabels: false,
      mirrored: false,
    });
    expect(result.svg).not.toContain('data-layer="labels"');
  });

  it('skips a region too small to fit a readable label', () => {
    // 3x3 = 9px region, well under the 40px minimum.
    const regionMap: RegionMap = {
      width: 3,
      height: 3,
      heightIndex: new Int16Array(9).fill(0),
      colorIndex: new Int16Array(9).fill(0),
    };
    const result = buildSvgPattern(regionMap, makeLegend(), {
      widthCm: 3,
      heightCm: 3,
      view: 'combined',
      showGrid: false,
      showLabels: true,
      mirrored: false,
    });
    expect(result.svg).not.toContain('data-layer="labels"');
  });

  it('never labels a color/height pair that does not actually occur', () => {
    // Two distinct large regions: C1-H1 and C1-H2. A phantom "C2-H1" must
    // never appear since colorIndex is always 0 here.
    const heightIndex = new Int16Array(100).fill(0);
    for (let i = 50; i < 100; i++) heightIndex[i] = 1;
    const regionMap: RegionMap = {
      width: 10,
      height: 10,
      heightIndex,
      colorIndex: new Int16Array(100).fill(0),
    };
    const result = buildSvgPattern(regionMap, makeLegend(), {
      widthCm: 10,
      heightCm: 10,
      view: 'combined',
      showGrid: false,
      showLabels: true,
      mirrored: false,
    });
    expect(result.svg).toContain('>C1-H1<');
    expect(result.svg).toContain('>C1-H2<');
    expect(result.svg).not.toContain('>C2-H1<');
  });

  it('anchors an annular (ring-shaped) region label to a pixel actually inside the ring', () => {
    // 9x9 square ring: a 3x3 hole in the middle is background. The pixel
    // *average* of the ring's own pixels lands in that hole -- not part of
    // the region at all -- so the label must not be placed there.
    const width = 9;
    const height = 9;
    const heightIndex = new Int16Array(width * height).fill(-1);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const isHole = x >= 3 && x <= 5 && y >= 3 && y <= 5;
        if (!isHole) heightIndex[y * width + x] = 0;
      }
    }
    const colorIndex = Int16Array.from(heightIndex).map((h) => (h === -1 ? -1 : 0));
    const regionMap: RegionMap = { width, height, heightIndex, colorIndex };

    const result = buildSvgPattern(regionMap, makeLegend(), {
      widthCm: width,
      heightCm: height,
      view: 'combined',
      showGrid: false,
      showLabels: true,
      mirrored: false,
    });

    const match = /<text x="([\d.]+)" y="([\d.]+)"/.exec(result.svg);
    expect(match).not.toBeNull();
    const [, xStr, yStr] = match as unknown as [string, string, string];
    const px = Math.round(Number(xStr) / result.pxPerCm - 0.5);
    const py = Math.round(Number(yStr) / result.pxPerCm - 0.5);
    expect(heightIndex[py * width + px]).toBe(0);
  });
});
