/**
 * Pure math for splitting a physical-size pattern across print pages (A4 /
 * US Letter / actual size) with configurable overlap, so multi-page tiled
 * printing can be unit tested without a browser or PDF library.
 */
import type { Cm } from '@/domain/units';

export type PageSize = 'a4' | 'letter' | 'actual-size';

export interface PageDimensionsCm {
  widthCm: number;
  heightCm: number;
}

const PAGE_SIZES_CM: Record<Exclude<PageSize, 'actual-size'>, PageDimensionsCm> = {
  a4: { widthCm: 21.0, heightCm: 29.7 },
  letter: { widthCm: 21.59, heightCm: 27.94 },
};

const DEFAULT_PRINT_MARGIN_CM = 1.0;

export interface TilePage {
  row: number;
  col: number;
  /** Region of the full pattern this page covers, in cm, before margin. */
  x0Cm: number;
  y0Cm: number;
  x1Cm: number;
  y1Cm: number;
  pageNumber: number;
}

export interface TilingResult {
  pages: TilePage[];
  rows: number;
  cols: number;
  printableWidthCm: number;
  printableHeightCm: number;
}

export function getPageDimensionsCm(
  pageSize: PageSize,
  actualSizeCm?: PageDimensionsCm,
): PageDimensionsCm {
  if (pageSize === 'actual-size') {
    if (!actualSizeCm) throw new Error('actualSizeCm is required when pageSize is "actual-size"');
    return actualSizeCm;
  }
  return PAGE_SIZES_CM[pageSize];
}

/**
 * Compute the page grid needed to cover a `patternWidthCm` x
 * `patternHeightCm` pattern, tiling pages with `overlapCm` shared border on
 * interior seams so pieces can be aligned and taped/glued after cutting.
 */
export function computeTiling(
  patternWidthCm: number,
  patternHeightCm: number,
  pageSize: PageSize,
  overlapCm = 1.0,
  marginCm = DEFAULT_PRINT_MARGIN_CM,
  actualSizeCm?: PageDimensionsCm,
): TilingResult {
  if (patternWidthCm <= 0 || patternHeightCm <= 0) {
    throw new RangeError('pattern dimensions must be positive');
  }
  if (overlapCm < 0) throw new RangeError('overlapCm must not be negative');

  const page = getPageDimensionsCm(pageSize, actualSizeCm);
  const printableWidthCm = page.widthCm - marginCm * 2;
  const printableHeightCm = page.heightCm - marginCm * 2;
  if (printableWidthCm <= overlapCm || printableHeightCm <= overlapCm) {
    throw new RangeError('overlap is too large for the printable page area');
  }

  // Single-page fast path: fits with no tiling needed.
  if (
    pageSize === 'actual-size' ||
    (patternWidthCm <= printableWidthCm && patternHeightCm <= printableHeightCm)
  ) {
    return {
      pages: [
        {
          row: 0,
          col: 0,
          x0Cm: 0,
          y0Cm: 0,
          x1Cm: patternWidthCm,
          y1Cm: patternHeightCm,
          pageNumber: 1,
        },
      ],
      rows: 1,
      cols: 1,
      printableWidthCm,
      printableHeightCm,
    };
  }

  const strideX = printableWidthCm - overlapCm;
  const strideY = printableHeightCm - overlapCm;
  const cols = Math.max(1, Math.ceil((patternWidthCm - overlapCm) / strideX));
  const rows = Math.max(1, Math.ceil((patternHeightCm - overlapCm) / strideY));

  const pages: TilePage[] = [];
  let pageNumber = 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = c * strideX;
      const y0 = r * strideY;
      const x1 = Math.min(patternWidthCm, x0 + printableWidthCm);
      const y1 = Math.min(patternHeightCm, y0 + printableHeightCm);
      pages.push({
        row: r,
        col: c,
        x0Cm: x0,
        y0Cm: y0,
        x1Cm: x1,
        y1Cm: y1,
        pageNumber: pageNumber++,
      });
    }
  }
  return { pages, rows, cols, printableWidthCm, printableHeightCm };
}

/** cm -> CSS px at 96dpi, used only for on-screen preview of print layout
 * (the actual PDF path uses the browser's native print pipeline -- see
 * docs/DECISIONS.md). */
export function cmToCssPx(value: Cm | number): number {
  return (value as number) * 37.795275591;
}
