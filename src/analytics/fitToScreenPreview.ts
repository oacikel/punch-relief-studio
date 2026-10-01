/**
 * EXP-007 ("ship fit-to-screen default plus pan and zoom as a standalone
 * release") assignment.
 *
 * This was not an A/B split measured against a concurrent control group --
 * the change (`PatternPreview.tsx`) shipped to everyone during its release
 * window and was compared with an equal-length pre-release window. The single
 * `fit` variant let `track()` stamp those release-window events with EXP-007.
 * That window has ended and EXP-003 now owns the live assignment, but this
 * historical implementation remains alongside the still-shipped preview
 * behavior.
 *
 * Mechanically the same self-assignment mechanism as the `?exp=` landing-URL
 * parser: written into the same sessionStorage slot `source.ts` caches
 * landing experiment context in, session-scoped rather than visitor-scoped,
 * and a no-op when a landing `?exp=` link already put the session in one.
 */
import { getCachedExperiment, writeExperimentContext } from '@/analytics/source';

/** The one place this experiment's ref is spelled out. */
export const FIT_TO_SCREEN_PREVIEW_EXPERIMENT_REF = 'EXP-007';

/** A standalone-release experiment has one variant, not a control -- kept
 * as a named type/constant so it reads the same way at call sites as a real
 * variant union would, and `VARIANT_PATTERN` compliance is asserted the
 * same way in tests. */
export type FitToScreenPreviewVariant = 'fit';

export const FIT_TO_SCREEN_PREVIEW_VARIANTS: readonly FitToScreenPreviewVariant[] = ['fit'];

/**
 * Enrolls this session in EXP-007 unless it is already in some experiment --
 * a landing `?exp=` link. Called from `initAnalytics()` immediately after
 * `captureLandingContext()`, under the same guards (analytics configured
 * and Global Privacy Control absent), so an unconfigured build still writes
 * no storage keys at all.
 */
export function assignFitToScreenPreviewExperiment(storage: Storage = window.sessionStorage): void {
  const existing = getCachedExperiment(storage);
  if (existing.experimentRef !== undefined) return;
  writeExperimentContext(
    {
      experimentRef: FIT_TO_SCREEN_PREVIEW_EXPERIMENT_REF,
      variant: 'fit' satisfies FitToScreenPreviewVariant,
    },
    storage,
  );
}
