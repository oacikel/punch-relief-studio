/**
 * Compose the printable SVG pattern: combined color+height regions,
 * region-outline contours (a line traced along every cell edge where the
 * height level changes -- not true marching squares, but deterministic and
 * fast enough at pattern resolution), per-region "C{n}-H{n}" labels, grid,
 * legend, scale bar, and registration marks. Kept separate from React so
 * it's testable headlessly and reusable for the PNG rasterization path
 * (draw the same SVG to a canvas).
 */
import type { RegionMap } from '@/domain/types';
import type { LegendEntry } from '@/domain/pattern/legend';
import { regionId, symbolForHeight } from '@/domain/regionId';
import { findConnectedComponents } from '@/domain/regionCleanup';

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
  const contour =
    options.view === 'contour' ? buildContourLines(regionMap, cellW, cellH, options.mirrored) : '';
  const labels = options.showLabels ? buildLabels(regionMap, cellW, cellH, options.mirrored) : '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}"
    viewBox="0 0 ${widthPx} ${heightPx}" data-view="${options.view}">
    <rect width="${widthPx}" height="${heightPx}" fill="#f7f3ec" />
    <g data-layer="regions">${cells.join('')}</g>
    ${contour}
    ${labels}
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

/**
 * "contour" view draws region cells with no fill (see `fillForView`), so
 * without this the view rendered nothing at all. Traces a line along every
 * cell edge where the height level changes (adjacent-pixel comparison,
 * not true marching squares -- sufficient at pattern raster resolution and
 * much cheaper).
 */
function buildContourLines(
  regionMap: RegionMap,
  cellW: number,
  cellH: number,
  mirrored: boolean,
): string {
  const { width, height, heightIndex } = regionMap;
  const cellX = (x: number): number => (mirrored ? width - 1 - x : x) * cellW;
  const segments: string[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const h = heightIndex[y * width + x] as number;
      if (h === -1) continue;

      if (x + 1 < width && heightIndex[y * width + x + 1] !== h) {
        const edgeX = mirrored ? cellX(x) : cellX(x) + cellW;
        segments.push(`M${edgeX},${y * cellH} v${cellH}`);
      }
      if (y + 1 < height && heightIndex[(y + 1) * width + x] !== h) {
        const left = cellX(x);
        segments.push(`M${left},${(y + 1) * cellH} h${cellW}`);
      }
    }
  }
  if (segments.length === 0) return '';
  return `<g data-layer="contour"><path d="${segments.join(' ')}" fill="none" stroke="#000" stroke-width="1" /></g>`;
}

const MIN_LABEL_AREA_PX = 40;

/**
 * `showLabels` was declared on SvgPatternOptions and always passed as
 * `true` by every caller, but nothing ever read it -- the pattern relied
 * entirely on fill color to distinguish regions, which CLAUDE.md
 * explicitly rules out ("never rely on color alone... always pair with a
 * symbol/ID"). Prints each connected region's "C{n}-H{n}" id at its
 * centroid, in every view (including "contour", which has no fill at all
 * and so has even less to go on without this). Reuses the same flood-fill
 * `findConnectedComponents` already used for tiny-region cleanup, keyed on
 * a combined color+height value so components only merge when both match.
 * Tiny regions are skipped -- a label wouldn't fit and would just clutter
 * the print.
 */
function buildLabels(
  regionMap: RegionMap,
  cellW: number,
  cellH: number,
  mirrored: boolean,
): string {
  const { width, height, heightIndex, colorIndex } = regionMap;
  const combined = new Int16Array(width * height).fill(-1);
  for (let i = 0; i < combined.length; i++) {
    const h = heightIndex[i] as number;
    const c = colorIndex[i] as number;
    if (h === -1 || c === -1) continue;
    combined[i] = c * 100 + h;
  }

  const labels: string[] = [];
  for (const comp of findConnectedComponents(combined, width, height)) {
    if (comp.pixels.length < MIN_LABEL_AREA_PX) continue;
    let sumX = 0;
    let sumY = 0;
    for (const p of comp.pixels) {
      sumX += p % width;
      sumY += Math.floor(p / width);
    }
    const avgX = sumX / comp.pixels.length;
    const avgY = sumY / comp.pixels.length;

    // The pixel average isn't guaranteed to land inside the region -- for
    // an annular (ring-shaped) region it lands near the center of the
    // whole circle, nowhere near the ring itself, since ring pixels are
    // symmetrically distributed all the way around. Anchor to whichever
    // actual member pixel is closest to that average instead, which by
    // construction always lies within the region.
    let bestPixel = comp.pixels[0] as number;
    let bestDistSq = Infinity;
    for (const p of comp.pixels) {
      const px = p % width;
      const py = Math.floor(p / width);
      const distSq = (px - avgX) ** 2 + (py - avgY) ** 2;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestPixel = p;
      }
    }
    const cx = bestPixel % width;
    const cy = Math.floor(bestPixel / width);
    const px = mirrored ? width - 1 - cx : cx;
    const x = (px + 0.5) * cellW;
    const y = (cy + 0.5) * cellH;
    const id = regionId(Math.floor(comp.levelValue / 100), comp.levelValue % 100);
    labels.push(
      `<text x="${x}" y="${y}" font-size="11" text-anchor="middle" dominant-baseline="middle" fill="#000" stroke="#fff" stroke-width="3" paint-order="stroke">${id}</text>`,
    );
  }
  if (labels.length === 0) return '';
  return `<g data-layer="labels">${labels.join('')}</g>`;
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
