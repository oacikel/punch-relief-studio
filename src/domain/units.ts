/**
 * Explicit unit types and conversions. Every measurement that crosses a
 * module boundary must be one of these branded types -- never a bare
 * `number` -- so that mixing pixels, normalized depth, model units,
 * centimetres, and inches is a compile-time error, not a runtime bug.
 *
 * See CLAUDE.md "Units discipline".
 */

declare const brand: unique symbol;
type Brand<T, B> = T & { readonly [brand]: B };

/** Raster pixels at a specific, stated output resolution. */
export type Px = Brand<number, 'Px'>;
/** Depth or relief value normalized to [0, 1]. Not a physical unit. */
export type NormalizedDepth = Brand<number, 'NormalizedDepth'>;
/** Raw coordinate in the imported mesh's own (unknown-scale) units. */
export type ModelUnits = Brand<number, 'ModelUnits'>;
export type Cm = Brand<number, 'Cm'>;
export type Inch = Brand<number, 'Inch'>;

export const px = (n: number): Px => n as Px;
export const normalizedDepth = (n: number): NormalizedDepth => clamp01(n) as NormalizedDepth;
export const modelUnits = (n: number): ModelUnits => n as ModelUnits;
export const cm = (n: number): Cm => n as Cm;
export const inch = (n: number): Inch => n as Inch;

const CM_PER_INCH = 2.54;

export function cmToInch(value: Cm): Inch {
  return inch(value / CM_PER_INCH);
}

export function inchToCm(value: Inch): Cm {
  return cm(value * CM_PER_INCH);
}

/**
 * Convert a physical length to a pixel count at a given raster density
 * (pixels per centimetre). Density must come from the pattern's stated
 * physical size divided by output resolution -- never assumed.
 */
export function cmToPx(value: Cm, pxPerCm: number): Px {
  return px(Math.round(value * pxPerCm));
}

export function pxToCm(value: Px, pxPerCm: number): Cm {
  if (pxPerCm <= 0) throw new Error('pxPerCm must be positive');
  return cm(value / pxPerCm);
}

export function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
