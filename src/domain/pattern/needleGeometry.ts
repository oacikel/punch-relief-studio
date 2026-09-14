/**
 * Physical punch-needle inputs. Needle-tip diameter controls the smallest
 * local feature the generated pattern keeps. Needle length is separate: it
 * can estimate the relative pile-height range for the simulation, but never
 * changes 2D pattern detail.
 *
 * The stored `throwMm` name is retained for project-file compatibility. In
 * the UI it is described as maximum needle length, the term craft-tool
 * makers use for the adjustable exposed length that controls loop height.
 */
import { cm, cmToPx, type Cm } from '../units';

export interface NeedleGeometry {
  /** Outside diameter of the needle tip/barrel, in mm. 0 means "not set". */
  diameterMm: number;
  /** Maximum exposed needle length, in mm. 0 means "not set". */
  throwMm: number;
}

export const DEFAULT_NEEDLE_GEOMETRY: NeedleGeometry = { diameterMm: 0, throwMm: 0 };

/** Working estimate based on the product owner's tool and experience. The
 * app never presents this estimate as a measured loop height. Yarn, fabric,
 * tension, and punching technique can all change the finished result. */
export const ESTIMATED_LOOP_HEIGHT_FRACTION = 0.5;

/** Diameter alone is enough to apply the physical detail floor. */
export function isNeedleDiameterSet(geometry: NeedleGeometry): boolean {
  return Number.isFinite(geometry.diameterMm) && geometry.diameterMm > 0;
}

/** The minimum retained zone/line width is one needle-tip diameter. */
export function minimumZoneWidthMm(geometry: NeedleGeometry): number {
  return isNeedleDiameterSet(geometry) ? geometry.diameterMm : 0;
}

/** Convert the diameter-driven physical width to raster pixels. The average
 * axis density keeps one deterministic threshold when a square capture is
 * mapped to non-square physical output dimensions. */
export function minimumZoneWidthPx(
  geometry: NeedleGeometry,
  widthCm: number,
  heightCm: number,
  rasterWidthPx: number,
  rasterHeightPx: number,
): number {
  if (!isNeedleDiameterSet(geometry)) return 0;
  if (widthCm <= 0 || heightCm <= 0 || rasterWidthPx <= 0 || rasterHeightPx <= 0) return 0;
  const pxPerCmX = rasterWidthPx / widthCm;
  const pxPerCmY = rasterHeightPx / heightCm;
  const pxPerCm = (pxPerCmX + pxPerCmY) / 2;
  const minWidthCm = cm(minimumZoneWidthMm(geometry) / 10);
  return cmToPx(minWidthCm, pxPerCm);
}

/** Estimated uncalibrated simulation height per generated pile level. The
 * tallest level reaches roughly half the entered maximum needle length.
 * Returns null when length is omitted so the established visual fallback is
 * used instead. */
export function estimatedPileHeightStepCm(levelCount: number, geometry: NeedleGeometry): Cm | null {
  if (!Number.isFinite(geometry.throwMm) || geometry.throwMm <= 0 || levelCount <= 0) return null;
  return cm((geometry.throwMm * ESTIMATED_LOOP_HEIGHT_FRACTION) / 10 / levelCount);
}
