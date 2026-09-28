import { describe, expect, it } from 'vitest';
import {
  PATTERN_PREVIEW_MAX_ZOOM,
  PATTERN_PREVIEW_MIN_ZOOM,
  clampPreviewZoom,
  isAtPreviewFit,
  panOffsetFromDrag,
  pointerDistance,
  zoomFromPinch,
  zoomFromWheelDelta,
} from '@/components/patternPreviewGestures';

/**
 * EXP-007's zoom/pan arithmetic, isolated from `PatternPreview.tsx`'s DOM
 * wiring specifically so it's unit-testable -- jsdom implements neither
 * `PointerEvent` nor `ResizeObserver` (see that file's header comment), so
 * anything depending on real pointer coordinates flowing through the DOM
 * event system is e2e-only.
 */
describe('clampPreviewZoom', () => {
  it('clamps to the min/max zoom range', () => {
    expect(clampPreviewZoom(0)).toBe(PATTERN_PREVIEW_MIN_ZOOM);
    expect(clampPreviewZoom(0.2)).toBe(PATTERN_PREVIEW_MIN_ZOOM);
    expect(clampPreviewZoom(100)).toBe(PATTERN_PREVIEW_MAX_ZOOM);
  });

  it('passes values already in range through unchanged', () => {
    expect(clampPreviewZoom(2.5)).toBe(2.5);
  });
});

describe('zoomFromWheelDelta', () => {
  it('zooms in on a negative deltaY (scroll/pinch up)', () => {
    expect(zoomFromWheelDelta(1, -100)).toBeGreaterThan(1);
  });

  it('zooms out on a positive deltaY', () => {
    const zoomedIn = zoomFromWheelDelta(2, 100);
    expect(zoomedIn).toBeLessThan(2);
  });

  it('never goes below the min or above the max zoom', () => {
    expect(zoomFromWheelDelta(PATTERN_PREVIEW_MIN_ZOOM, 10_000)).toBe(PATTERN_PREVIEW_MIN_ZOOM);
    expect(zoomFromWheelDelta(PATTERN_PREVIEW_MAX_ZOOM, -10_000)).toBe(PATTERN_PREVIEW_MAX_ZOOM);
  });

  it('a zero delta leaves zoom unchanged', () => {
    expect(zoomFromWheelDelta(2, 0)).toBe(2);
  });
});

describe('pointerDistance', () => {
  it('measures the straight-line distance between two points', () => {
    expect(pointerDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});

describe('zoomFromPinch', () => {
  it('scales zoom by how much the pinch distance has grown', () => {
    expect(zoomFromPinch(1, 100, 200)).toBe(2);
    expect(zoomFromPinch(2, 200, 100)).toBe(1);
  });

  it('clamps the result to the zoom range', () => {
    expect(zoomFromPinch(PATTERN_PREVIEW_MAX_ZOOM, 100, 1_000)).toBe(PATTERN_PREVIEW_MAX_ZOOM);
    expect(zoomFromPinch(PATTERN_PREVIEW_MIN_ZOOM, 100, 1)).toBe(PATTERN_PREVIEW_MIN_ZOOM);
  });

  it('leaves zoom at its starting (clamped) value rather than dividing by zero', () => {
    expect(zoomFromPinch(2, 0, 50)).toBe(2);
    expect(zoomFromPinch(2, -5, 50)).toBe(2);
  });
});

describe('panOffsetFromDrag', () => {
  it('adds how far the pointer moved to the offset the drag started at', () => {
    const result = panOffsetFromDrag({ x: 10, y: -5 }, { x: 100, y: 100 }, { x: 130, y: 90 });
    expect(result).toEqual({ x: 40, y: -15 });
  });

  it('is a no-op when the pointer has not moved', () => {
    const result = panOffsetFromDrag({ x: 10, y: -5 }, { x: 100, y: 100 }, { x: 100, y: 100 });
    expect(result).toEqual({ x: 10, y: -5 });
  });
});

describe('isAtPreviewFit', () => {
  it('is true only at min zoom with no pan offset', () => {
    expect(isAtPreviewFit(PATTERN_PREVIEW_MIN_ZOOM, { x: 0, y: 0 })).toBe(true);
    expect(isAtPreviewFit(2, { x: 0, y: 0 })).toBe(false);
    expect(isAtPreviewFit(PATTERN_PREVIEW_MIN_ZOOM, { x: 5, y: 0 })).toBe(false);
    expect(isAtPreviewFit(PATTERN_PREVIEW_MIN_ZOOM, { x: 0, y: 5 })).toBe(false);
  });
});
