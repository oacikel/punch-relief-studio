import { useEffect, useRef, useState } from 'react';
import {
  PATTERN_PREVIEW_MIN_ZOOM,
  clampPreviewZoom,
  isAtPreviewFit,
  panOffsetFromDrag,
  pointerDistance,
  zoomFromPinch,
  zoomFromWheelDelta,
  type PreviewOffset,
} from '@/components/patternPreviewGestures';

interface Props {
  src: string | null;
  alt: string;
  fit?: boolean;
  onFitChange?: (fit: boolean) => void;
}

/**
 * Pan/zoom viewer for the pattern preview image (EXP-007 -- "ship
 * fit-to-screen default plus pan and zoom as a standalone release", see
 * docs/ANALYTICS.md). The `<img>` sits inside a fixed-height,
 * `object-fit: contain` box (`.pattern-preview-viewport` in styles.css) --
 * that CSS fit, not anything computed here, is what makes the *whole*
 * pattern visible on open regardless of its own aspect ratio. `zoom`/
 * `offset` are an additional scale/translate layered on top of that base
 * fit: `zoom === PATTERN_PREVIEW_MIN_ZOOM` (1) means exactly that CSS fit,
 * so panning has nowhere to go until zoomed in past it, and "Fit to
 * screen" is just resetting both back to their defaults. The actual
 * zoom/pan arithmetic lives in `patternPreviewGestures.ts`, unit-tested on
 * its own -- see that file's header for why (no `PointerEvent` in jsdom).
 */
export function PatternPreview({ src, alt, fit = true, onFitChange }: Props): JSX.Element {
  const [zoom, setZoom] = useState(PATTERN_PREVIEW_MIN_ZOOM);
  const [offset, setOffset] = useState<PreviewOffset>({ x: 0, y: 0 });
  // Mutable gesture-tracking state, not React state: it changes on every
  // pointermove of an active drag/pinch and never itself needs to trigger
  // a re-render -- only the zoom/offset state it derives does. Keyed by
  // pointerId so a two-finger touch pinch and a mouse drag share one set
  // of handlers.
  const pointersRef = useRef(new Map<number, PreviewOffset>());
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const panRef = useRef<{ start: PreviewOffset; offset: PreviewOffset } | null>(null);

  // A newly generated pattern (a different SVG -- a view-mode toggle, a
  // live regeneration, a new import) always reopens fit to the viewport;
  // carrying over a previous zoom/pan would show a cropped fragment of a
  // pattern the person hasn't seen yet.
  useEffect(() => {
    setZoom(PATTERN_PREVIEW_MIN_ZOOM);
    setOffset({ x: 0, y: 0 });
  }, [src]);

  const applyZoom = (nextZoom: number): void => {
    const clamped = clampPreviewZoom(nextZoom);
    if (clamped > PATTERN_PREVIEW_MIN_ZOOM) onFitChange?.(false);
    setZoom(clamped);
    if (clamped === PATTERN_PREVIEW_MIN_ZOOM) setOffset({ x: 0, y: 0 });
  };

  const resetToFit = (): void => {
    onFitChange?.(true);
    setZoom(PATTERN_PREVIEW_MIN_ZOOM);
    setOffset({ x: 0, y: 0 });
  };

  const endPointer = (pointerId: number): void => {
    pointersRef.current.delete(pointerId);
    pinchRef.current = null;
    const remaining = Array.from(pointersRef.current.values());
    const [only] = remaining;
    panRef.current = remaining.length === 1 && only ? { start: only, offset } : null;
  };

  const atFit = fit && isAtPreviewFit(zoom, offset);

  return (
    <div className="pattern-preview">
      <div
        className={`pattern-preview-viewport pattern-preview-viewport--${fit ? 'fit' : 'zoom'}`}
        onWheel={(e) => {
          if (!src) return;
          e.preventDefault();
          applyZoom(zoomFromWheelDelta(zoom, e.deltaY));
        }}
        onPointerDown={(e) => {
          if (!src) return;
          // Not implemented by jsdom (see patternPreviewGestures.ts) --
          // optional so unit tests mounting this component don't throw;
          // every real, currently-shipping browser has it.
          e.currentTarget.setPointerCapture?.(e.pointerId);
          pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          const points = Array.from(pointersRef.current.values());
          const [a, b] = points;
          if (points.length === 2 && a && b) {
            pinchRef.current = { distance: pointerDistance(a, b), zoom };
            panRef.current = null;
          } else {
            panRef.current = { start: { x: e.clientX, y: e.clientY }, offset };
          }
        }}
        onPointerMove={(e) => {
          if (!pointersRef.current.has(e.pointerId)) return;
          pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          const points = Array.from(pointersRef.current.values());
          const [a, b] = points;
          if (points.length === 2 && a && b && pinchRef.current) {
            const distance = pointerDistance(a, b);
            applyZoom(zoomFromPinch(pinchRef.current.zoom, pinchRef.current.distance, distance));
          } else if (panRef.current && zoom > PATTERN_PREVIEW_MIN_ZOOM) {
            setOffset(
              panOffsetFromDrag(panRef.current.offset, panRef.current.start, {
                x: e.clientX,
                y: e.clientY,
              }),
            );
          }
        }}
        onPointerUp={(e) => endPointer(e.pointerId)}
        onPointerCancel={(e) => endPointer(e.pointerId)}
        onPointerLeave={(e) => endPointer(e.pointerId)}
      >
        {src && (
          <img
            src={src}
            alt={alt}
            className={`pattern-preview-image pattern-preview-image--${fit ? 'fit' : 'zoom'}`}
            draggable={false}
            style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
          />
        )}
      </div>
      <div className="pattern-preview-controls" role="group" aria-label="Pattern preview zoom">
        <button type="button" onClick={resetToFit} disabled={atFit}>
          Fit to screen
        </button>
        <span aria-live="polite">{Math.round(zoom * 100)}% zoom</span>
      </div>
    </div>
  );
}
