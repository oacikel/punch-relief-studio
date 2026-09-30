/**
 * EXP-003 ("clarify the single-viewpoint preview") assignment.
 *
 * Hypothesis: setting expectations *before* the first preview reduces
 * confusion during export. The product's output is a single-viewpoint
 * bas-relief interpretation, not a full 3D reconstruction (CLAUDE.md's
 * standing constraint), and today that is one line of helper text on the
 * Import/Orient step. EXP-003 tests whether spelling it out concretely --
 * this view only, depth as a few discrete pile heights, overhangs flattened,
 * and an export sheet that is exactly that -- before the person ever reaches
 * the Workspace preview moves the end of the funnel.
 *
 * Two variants:
 *
 * - `expectations` -- the `PreviewExpectations` notice replaces the one-line
 *   helper text on the Import/Orient step, right above "Create my pattern";
 * - `control`      -- that step is exactly as it was, so the funnel this is
 *   meant to move (`pattern_completed` -> `export_succeeded`/`export_failed`,
 *   per docs/ANALYTICS.md) has something to be compared against.
 *
 * Mechanically identical to EXP-004's self-assignment (see `experiment.ts`
 * for the full account): the variant is written into the same sessionStorage
 * slot `source.ts` caches landing experiment context in, so `track()`
 * attaches `experimentRef: 'EXP-003'` + `variant` to every product event with
 * no change at any call site and no new event names. A link-provided
 * experiment still always wins, and the assignment is session-scoped rather
 * than visitor-scoped so nothing durable is written before consent.
 *
 * **Only one self-assigned experiment can be live at a time.** An event
 * carries a single `experimentRef`, and a session has a single slot for it,
 * so EXP-003, EXP-004 and EXP-007 cannot both/all label the same events.
 * `initAnalytics()` assigns the live one first and every later assignment is
 * then a no-op (the slot is full).
 *
 * **Currently dormant** -- EXP-007 (`fitToScreenPreview.ts`) is the live
 * self-assigned experiment as of its release window. The notice still shows
 * for everyone (an unassigned session falls back to `expectations`, see
 * `getPreviewExpectationsVariant` below); only the comparison against
 * `control` stops for the duration. Nothing in this file needed changing to
 * resume EXP-003; that's one line in `index.ts`. See docs/ANALYTICS.md and
 * docs/DECISIONS.md.
 */
import { generateRandomId } from '@/analytics/ids';
import { getCachedExperiment, writeExperimentContext } from '@/analytics/source';

/** The one place this experiment's ref is spelled out. */
export const PREVIEW_EXPECTATIONS_EXPERIMENT_REF = 'EXP-003';

export type PreviewExpectationsVariant = 'control' | 'expectations';

/** Both variant slugs satisfy the contract's `VARIANT_PATTERN`; asserted in
 * `__tests__/previewExpectations.test.ts` so a future rename can't quietly
 * produce a value the ingest server rejects the whole event for. */
export const PREVIEW_EXPECTATIONS_VARIANTS: readonly PreviewExpectationsVariant[] = [
  'control',
  'expectations',
];

/** 50/50 from the parity of the first hex digit of a fresh random ID --
 * reuses `generateRandomId`'s crypto-preferring source rather than adding a
 * second notion of randomness. Takes the hex string as an argument so tests
 * can pin a variant instead of retrying until chance cooperates. */
export function pickPreviewExpectationsVariant(
  randomHex: string = generateRandomId(),
): PreviewExpectationsVariant {
  const firstDigit = Number.parseInt(randomHex.slice(0, 1), 16);
  if (!Number.isFinite(firstDigit)) return 'expectations';
  return firstDigit % 2 === 0 ? 'control' : 'expectations';
}

/**
 * Enrolls this session in EXP-003 unless it is already in some experiment --
 * a landing `?exp=` link, or another self-assigned experiment that ran first.
 * Called from `initAnalytics()` immediately after `captureLandingContext()`,
 * under the same guards (analytics configured and Global Privacy Control
 * absent), so an unconfigured build still writes no storage keys at all.
 */
export function assignPreviewExpectationsExperiment(
  storage: Storage = window.sessionStorage,
  variant: PreviewExpectationsVariant = pickPreviewExpectationsVariant(),
): void {
  const existing = getCachedExperiment(storage);
  if (existing.experimentRef !== undefined) return;
  writeExperimentContext({ experimentRef: PREVIEW_EXPECTATIONS_EXPERIMENT_REF, variant }, storage);
}

/**
 * The variant this session is in, for the UI to branch on. Returns
 * `expectations` when the session isn't enrolled in EXP-003 at all -- either
 * because analytics is unconfigured (the public build: nothing to measure, so
 * the clearer copy is simply the product's behaviour) or because a link put
 * this session in a different experiment. Withholding the clarification is
 * the measurement's cost, and it is only worth paying where the measurement
 * actually happens.
 */
export function getPreviewExpectationsVariant(
  storage: Storage = window.sessionStorage,
): PreviewExpectationsVariant {
  const { experimentRef, variant } = getCachedExperiment(storage);
  if (experimentRef !== PREVIEW_EXPECTATIONS_EXPERIMENT_REF) return 'expectations';
  return PREVIEW_EXPECTATIONS_VARIANTS.find((candidate) => candidate === variant) ?? 'expectations';
}
