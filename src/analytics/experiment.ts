/**
 * EXP-004 ("show a first-project guide after import") assignment.
 *
 * Every experiment before this one was exposed by link -- `?exp=EXP-00n&v=x`
 * on the landing URL, parsed by `source.ts` -- which works for a campaign
 * but not for an in-product change that has to be decided before the person
 * has done anything. EXP-004 therefore assigns itself, client-side, into one
 * of two variants:
 *
 * - `guide`   -- the first-project guide is shown after import;
 * - `control` -- it is not, so the funnel it's meant to move
 *                (`project_created` -> `pattern_completed` ->
 *                `export_succeeded`, per docs/ANALYTICS.md) has something
 *                to be compared against.
 *
 * The assignment is written into the same sessionStorage slot `source.ts`
 * already caches landing experiment context in, so `track()` attaches
 * `experimentRef: 'EXP-004'` + `variant` to every product event with no
 * change at the call sites and no new event names (the event dictionary is
 * a closed whitelist -- see `eventBuilder.ts`).
 *
 * Two deliberate scoping decisions, both recorded in docs/DECISIONS.md:
 *
 * 1. **A link-provided experiment always wins.** If the landing URL already
 *    put an experiment in the cache, EXP-004 does not overwrite it -- a
 *    person recruited into another experiment stays in that one, and their
 *    events keep carrying that ref rather than being silently re-labelled.
 * 2. **Session-scoped, not visitor-scoped.** The variant lives in
 *    sessionStorage alongside the rest of the landing context, so a
 *    returning visitor can land in the other variant on a later visit.
 *    That is accepted rather than worked around: the funnel this measures
 *    starts at a `page_viewed{path:"/"}` that is itself per-session, and
 *    persisting an assignment in localStorage would mean writing a
 *    durable key before consent, which T10 promises not to do.
 *
 * **Currently dormant.** EXP-007 (`fitToScreenPreview.ts`) is the live
 * self-assigned experiment, and only one can be: an event carries a single
 * `experimentRef`. `initAnalytics()` assigns the live one first, so the call
 * below is a no-op while EXP-007's release window runs and
 * `getFirstProjectGuideVariant()` falls back to `guide` -- i.e. the
 * first-project guide keeps showing for everyone, it just isn't being
 * measured. Nothing here needs changing to resume EXP-004; see the ordering
 * comment in `index.ts`.
 */
import { generateRandomId } from '@/analytics/ids';
import { getCachedExperiment, writeExperimentContext } from '@/analytics/source';

/** The one place this experiment's ref is spelled out. */
export const FIRST_PROJECT_GUIDE_EXPERIMENT_REF = 'EXP-004';

export type FirstProjectGuideVariant = 'control' | 'guide';

/** Both variant slugs satisfy the contract's `VARIANT_PATTERN`; asserted in
 * `__tests__/experiment.test.ts` so a future rename can't quietly produce a
 * value the ingest server rejects the whole event for. */
export const FIRST_PROJECT_GUIDE_VARIANTS: readonly FirstProjectGuideVariant[] = [
  'control',
  'guide',
];

/** 50/50 from the parity of the first hex digit of a fresh random ID --
 * reuses `generateRandomId`'s crypto-preferring source rather than adding a
 * second notion of randomness. Takes the hex string as an argument so tests
 * can pin a variant instead of retrying until chance cooperates. */
export function pickFirstProjectGuideVariant(
  randomHex: string = generateRandomId(),
): FirstProjectGuideVariant {
  const firstDigit = Number.parseInt(randomHex.slice(0, 1), 16);
  if (!Number.isFinite(firstDigit)) return 'guide';
  return firstDigit % 2 === 0 ? 'control' : 'guide';
}

/**
 * Enrolls this session in EXP-004 unless it is already in some experiment
 * (see decision 1 above). Called from `initAnalytics()` immediately after
 * `captureLandingContext()`, under the same guards -- analytics configured
 * and Global Privacy Control absent -- so an unconfigured build still
 * writes no storage keys at all.
 */
export function assignFirstProjectGuideExperiment(
  storage: Storage = window.sessionStorage,
  variant: FirstProjectGuideVariant = pickFirstProjectGuideVariant(),
): void {
  const existing = getCachedExperiment(storage);
  if (existing.experimentRef !== undefined) return;
  writeExperimentContext({ experimentRef: FIRST_PROJECT_GUIDE_EXPERIMENT_REF, variant }, storage);
}

/**
 * The variant this session is in, for the UI to branch on. Returns `guide`
 * when the session isn't enrolled in EXP-004 at all -- either because
 * analytics is unconfigured (the public build: nothing to measure, so the
 * guide is simply the product's behaviour) or because a link put this
 * session in a different experiment. Withholding the guide is the
 * measurement's cost, and it is only worth paying where the measurement
 * actually happens.
 */
export function getFirstProjectGuideVariant(
  storage: Storage = window.sessionStorage,
): FirstProjectGuideVariant {
  const { experimentRef, variant } = getCachedExperiment(storage);
  if (experimentRef !== FIRST_PROJECT_GUIDE_EXPERIMENT_REF) return 'guide';
  return FIRST_PROJECT_GUIDE_VARIANTS.find((candidate) => candidate === variant) ?? 'guide';
}
