/**
 * Pure zoom/pan math for `PatternPreview.tsx` (EXP-007 -- see
 * docs/ANALYTICS.md), kept separate from the component's DOM/pointer-event
 * wiring so it can be unit-tested directly: jsdom implements neither
 * `PointerEvent` nor `ResizeObserver`, so anything that depends on real
 * pointer coordinates arriving through the DOM event system is only
 * verifiable in a real browser (e2e). The arithmetic itself has no such
 * dependency.
 */

/** `1` is exactly the CSS `object-fit: contain` base fit `.pattern-preview-
 * viewport` applies in styles.css -- there is nothing to zoom *out* to
 * beyond it, since the whole pattern is already visible there. */
export const PATTERN_PREVIEW_MIN_ZOOM = 1;
export const PATTERN_PREVIEW_MAX_ZOOM = 6;

export interface PreviewOffset {
  x: number;
  y: number;
}

export function clampPreviewZoom(zoom: number): number {
  return Math.min(PATTERN_PREVIEW_MAX_ZOOM, Math.max(PATTERN_PREVIEW_MIN_ZOOM, zoom));
}

/** Multiplicative zoom from a wheel/trackpad `deltaY` -- negative `deltaY`
 * (scrolling/pinching "up") zooms in. The `exp` form gives a smooth,
 * frame-rate-independent feel across both a mouse wheel's large per-tick
 * deltas and a trackpad's many small ones, rather than a fixed step per
 * event. */
export function zoomFromWheelDelta(currentZoom: number, deltaY: number): number {
  return clampPreviewZoom(currentZoom * Math.exp(-deltaY * 0.0015));
}

export function pointerDistance(a: PreviewOffset, b: PreviewOffset): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Zoom implied by how much the distance between two touch points has
 * changed since the pinch gesture started. `startDistance <= 0` (the two
 * touch points registered at literally the same pixel -- not reachable
 * with real fingers, but not guaranteed impossible either) leaves zoom
 * unchanged instead of dividing by zero. */
export function zoomFromPinch(
  startZoom: number,
  startDistance: number,
  currentDistance: number,
): number {
  if (startDistance <= 0) return clampPreviewZoom(startZoom);
  return clampPreviewZoom(startZoom * (currentDistance / startDistance));
}

/** Pan offset from a single-pointer drag: the offset the gesture started
 * at, plus how far the pointer has moved since. */
export function panOffsetFromDrag(
  startOffset: PreviewOffset,
  dragStart: PreviewOffset,
  current: PreviewOffset,
): PreviewOffset {
  return {
    x: startOffset.x + (current.x - dragStart.x),
    y: startOffset.y + (current.y - dragStart.y),
  };
}

/** Whether zoom/offset are exactly the fit-to-screen default -- used both
 * to disable the redundant "Fit to screen" button and to decide whether a
 * single-pointer drag should pan at all (see `PatternPreview.tsx`: at fit,
 * the whole pattern is already visible, so there's nowhere to pan to). */
export function isAtPreviewFit(zoom: number, offset: PreviewOffset): boolean {
  return zoom === PATTERN_PREVIEW_MIN_ZOOM && offset.x === 0 && offset.y === 0;
}
