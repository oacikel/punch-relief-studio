/**
 * Live relief regeneration (Iteration 03's combined-workspace change --
 * docs/ITERATION_03_PLAN.md #13), replacing the old manual "Generate
 * relief" button. Debounces relief-generation-affecting setting changes
 * (pile heights, min-region preset, relief depth, smoothing, raise-near-
 * surfaces, quantization mode, edge preservation, and model rotation --
 * NOT yarn color/palette/view-mode/grid/label/pile-style/lighting changes,
 * which only affect rendering and never reach this hook) into a single
 * capture+worker-process cycle, and guards against a slower, stale
 * request overwriting a newer one's result. See docs/DECISIONS.md for the
 * debounce interval's justification and the generation-counter design
 * (chosen over AbortController-style cancellation, since the single
 * long-lived Worker `useProcessingWorker` owns has no real cancellation
 * primitive -- an in-flight request is left to finish, its result just
 * isn't applied if a newer one has since started).
 *
 * Pure orchestration only -- no quantization/scaling logic lives here,
 * per CLAUDE.md's component/hook boundary; `capture`/`process`/
 * `buildProcessArgs` are all injected so this hook has zero direct
 * coupling to Three.js or the Worker's message-passing details, which
 * also makes it testable with plain mocked functions (see
 * `__tests__/useLiveRelief.test.ts`).
 */
import { useEffect, useRef } from 'react';
import type { DepthCaptureResult } from '@/three/depthCapture';
import type { ProcessArgs } from '@/hooks/useProcessingWorker';
import type { ProcessResponse } from '@/workers/processing.worker';
import type { ReliefSettings } from '@/domain/types';
import type { RotationDeg } from '@/state/appState';

/** ~196ms was the one clean, uncontended measurement of a worst-case
 * (12 pile heights, 256px capture) full capture+worker round trip taken
 * during this change's implementation (see docs/DECISIONS.md for the full
 * profiling account, including why repeated measurements in the same
 * session were unreliable). 300ms leaves real headroom above that for
 * slower hardware while staying well under the point where a live control
 * starts to feel laggy -- an engineering judgment call, not re-derived
 * from a formula. */
const DEFAULT_DEBOUNCE_MS = 300;

export interface UseLiveReliefOptions {
  /** Nothing to generate until a model has been imported. */
  hasModel: boolean;
  reliefSettings: ReliefSettings;
  rotationDeg: RotationDeg;
  /** Whether the *next* triggered generation should ask for source-material
   * color capture -- read fresh at fire time via a ref-to-latest-options
   * pattern, deliberately not itself a trigger (see file-level doc
   * comment: color-mode changes only affect rendering). */
  captureColor: boolean;
  capture: (resolutionPx: number, captureColor: boolean) => DepthCaptureResult | null;
  buildProcessArgs: (captured: DepthCaptureResult) => ProcessArgs;
  process: (args: ProcessArgs) => Promise<ProcessResponse>;
  onStart: () => void;
  /** `capturedWidth`/`capturedHeight` are the actual raster dimensions
   * `capture()` produced for this specific request (always square, per
   * `Viewport3DHandle.capture`'s single `resolution` argument) -- passed
   * through explicitly rather than having the caller re-derive them from
   * *current* settings, which could have drifted from what was true when
   * this particular request was captured. */
  onSuccess: (result: ProcessResponse, capturedWidth: number, capturedHeight: number) => void;
  onError: (message: string) => void;
  debounceMs?: number;
}

export function useLiveRelief(options: UseLiveReliefOptions): void {
  const generationRef = useRef(0);
  // Always-fresh ref to the latest options, so the debounce timer's
  // callback (created inside the effect below) reads current
  // capture/process/callbacks/captureColor even if this hook re-renders
  // with new function identities before the timer fires -- avoids listing
  // every callback prop in the effect's dependency array, which would
  // otherwise re-run (and re-debounce) on every unrelated parent
  // re-render. Same pattern already used in this codebase for
  // Viewport3D.tsx/SimulationView.tsx's own effects.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!options.hasModel) return;

    // Bump immediately (not inside the timer below) -- this is what
    // invalidates a still-in-flight older request the instant a newer
    // trigger is observed, not just once that older request eventually
    // completes. See docs/DECISIONS.md for why this matters for the
    // out-of-order-completion race.
    generationRef.current += 1;
    const myGeneration = generationRef.current;

    const debounceMs = optionsRef.current.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    const timeoutId = setTimeout(() => {
      void (async () => {
        const opts = optionsRef.current;
        const captured = opts.capture(opts.reliefSettings.outputResolutionPx, opts.captureColor);
        if (!captured) return; // nothing to capture yet -- no onStart, silent no-op
        opts.onStart();
        try {
          const result = await opts.process(opts.buildProcessArgs(captured));
          if (generationRef.current !== myGeneration) return; // superseded, discard
          opts.onSuccess(result, captured.width, captured.height);
        } catch (err) {
          if (generationRef.current !== myGeneration) return;
          opts.onError(err instanceof Error ? err.message : String(err));
        }
      })();
    }, debounceMs);

    return () => clearTimeout(timeoutId);
    // reliefSettings/rotationDeg are the actual regen-affecting triggers
    // (compared by reference -- every dispatch that changes them produces
    // a new object, per appState.ts's reducer, so this is a correct and
    // sufficient dependency list). Everything else this effect reads goes
    // through optionsRef.current, deliberately excluded from deps -- see
    // the comment on optionsRef above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.hasModel, options.reliefSettings, options.rotationDeg]);
}
