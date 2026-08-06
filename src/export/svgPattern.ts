/**
 * Compose the printable SVG pattern: combined color+height regions,
 * region-outline contours (marching-squares-free approximation via per-
 * pixel cell rects grouped by scanline -- simple, deterministic, and fast
 * enough at pattern resolution), grid, legend, scale bar, and registration
 * marks. Kept separate from React so it's testable headlessly and reusable
 * for the PNG rasterization path (draw the same SVG to a canvas).
 */
import type { RegionMap } from '@/domain/types';
import type { LegendEntry } from '@/domain/pattern/legend';
import { regionId, symbolForHeight } from '@/domain/regionId';

export type PatternView = 'combined' | 'color-only' | 'height-only' | 'contour';

export interface SvgPatternOptions {
  widthCm: number;
  heightCm: number;
  view: PatternView;
  showGrid: boolean;
  showLabels: boolean;
  mirrored: boolean;
  pxPerCm?: number;
}

export interface SvgPatternResult {
  svg: string;
  widthCm: number;
  heightCm: number;
  pxPerCm: number;
}

const DEFAULT_PX_PER_CM = 20;

export function buildSvgPattern(
  regionMap: RegionMap,
  legend: LegendEntry[],
  options: SvgPatternOptions,
): SvgPatternResult {
  const pxPerCm = options.pxPerCm ?? DEFAULT_PX_PER_CM;
  const widthPx = options.widthCm * pxPerCm;
  const heightPx = options.heightCm * pxPerCm;
  const cellW = widthPx / regionMap.width;
  const cellH = heightPx / regionMap.height;

  const legendById = new Map(legend.map((e) => [e.id, e]));
  const cells: string[] = [];

  for (let y = 0; y < regionMap.height; y++) {
    for (let x = 0; x < regionMap.width; x++) {
      const i = y * regionMap.width + x;
      const h = regionMap.heightIndex[i] as number;
      const c = regionMap.colorIndex[i] as number;
      if (h === -1) continue;
      const id = regionId(c, h);
      const entry = legendById.get(id);
      const fill = fillForView(options.view, entry, h);
      const px = options.mirrored ? regionMap.width - 1 - x : x;
      cells.push(
        `<rect x="${px * cellW}" y="${y * cellH}" width="${cellW + 0.5}" height="${cellH + 0.5}" fill="${fill}" />`,
      );
    }
  }

  const grid = options.showGrid ? buildGrid(widthPx, heightPx, pxPerCm) : '';
  const registration = buildRegistrationMarks(widthPx, heightPx);
  const scaleBar = buildScaleBar(heightPx, pxPerCm);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}"
    viewBox="0 0 ${widthPx} ${heightPx}" data-view="${options.view}">
    <rect width="${widthPx}" height="${heightPx}" fill="#f7f3ec" />
    <g data-layer="regions">${cells.join('')}</g>
    ${grid}
    ${registration}
    ${scaleBar}
  </svg>`;

  return { svg, widthCm: options.widthCm, heightCm: options.heightCm, pxPerCm };
}

function fillForView(
  view: PatternView,
  entry: LegendEntry | undefined,
  heightIndex: number,
): string {
  if (view === 'height-only') {
    // Grayscale ramp by height so it reads without color.
    const shade = Math.round((heightIndex / 7) * 200 + 30);
    return `rgb(${shade},${shade},${shade})`;
  }
  if (view === 'contour') return 'none';
  return entry?.color ?? '#cccccc';
}

function buildGrid(widthPx: number, heightPx: number, pxPerCm: number): string {
  const lines: string[] = [];
  for (let x = 0; x <= widthPx; x += pxPerCm) {
    lines.push(
      `<line x1="${x}" y1="0" x2="${x}" y2="${heightPx}" stroke="#00000022" stroke-width="0.5" />`,
    );
  }
  for (let y = 0; y <= heightPx; y += pxPerCm) {
    lines.push(
      `<line x1="0" y1="${y}" x2="${widthPx}" y2="${y}" stroke="#00000022" stroke-width="0.5" />`,
    );
  }
  return `<g data-layer="grid">${lines.join('')}</g>`;
}

function buildRegistrationMarks(widthPx: number, heightPx: number): string {
  const size = 12;
  const corner = (x: number, y: number): string =>
    `<path d="M${x - size},${y} h${size * 2} M${x},${y - size} v${size * 2}" stroke="#000" stroke-width="1" />`;
  return `<g data-layer="registration">
    ${corner(size, size)}${corner(widthPx - size, size)}
    ${corner(size, heightPx - size)}${corner(widthPx - size, heightPx - size)}
  </g>`;
}

function buildScaleBar(heightPx: number, pxPerCm: number): string {
  const barCm = 5;
  const y = heightPx - 20;
  return `<g data-layer="scale">
    <line x1="20" y1="${y}" x2="${20 + barCm * pxPerCm}" y2="${y}" stroke="#000" stroke-width="2" />
    <text x="20" y="${y - 6}" font-size="10">${barCm} cm scale check</text>
  </g>`;
}

export { symbolForHeight };
