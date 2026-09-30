/**
 * EXP-007 ("ship fit-to-screen default plus pan and zoom as a standalone
 * release") assignment.
 *
 * This is not an A/B split measured against a concurrent control group --
 * the change (`PatternPreview.tsx`) ships to *everyone* who opens the
 * pattern preview during the release window, and is compared against an
 * equal-length window immediately *before* the release instead (manual
 * counts of `export_succeeded`/`export_failed` for each window -- see
 * docs/ANALYTICS.md). There is therefore exactly one variant, `fit`, and no
 * code branches on it: the self-assignment exists purely so `track()` (see
 * `index.ts`) stamps `experimentRef: 'EXP-007'` on every product event of a
 * release-window session, which is what lets that window's export counts be
 * told apart from the pre-release window's (whose events predate this file
 * and so carry no experimentRef at all).
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
