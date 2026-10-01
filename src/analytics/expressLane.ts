/**
 * EXP-011 ("Express lane: one screen from import to export, with Export
 * always visible") assignment.
 *
 * Hypothesis: the Workspace rail's step gating -- Shape, then Yarn, then
 * Export, each hidden until its own numbered step is clicked -- is itself
 * what suppresses completed exports, separate from whatever the exported
 * output looks like. `express` removes the gating: Shape, Yarn and Export
 * all render on one scrolling screen, Export included, from the first
 * render.
 *
 * Unlike every earlier self-assigned experiment in this codebase, EXP-011
 * is **link-only, not a 50/50 split**: the task brief recruits 8-12 makers
 * directly (guild forums, craft Discord/Reddit, the owner's contacts) and
 * hands each one a link -- `?exp=EXP-011&v=rail` for today's gated rail,
 * `?exp=EXP-011&v=express` for the one-screen build -- rather than randomly
 * splitting organic traffic. So there is no `pickExpressLaneVariant`/
 * `assignExpressLaneExperiment` pair here: the existing `?exp=`/`v=`
 * landing-link mechanism (`source.ts`) is the whole assignment, same as it
 * was for EXP-002/EXP-003 before either grew a self-assigning fallback.
 *
 * One real difference from that shared mechanism: `source.ts`'s cache is
 * only ever populated from `captureLandingContext()`, which `initAnalytics()`
 * calls only when analytics is configured and Global Privacy Control is
 * absent. EXP-011's own collection plan is "count `export_succeeded`/
 * `export_failed` from analytics events if ingest is configured in the test
 * build, and otherwise tally completed exports by hand from a post-session
 * form" -- i.e. which build a recruited maker sees must not depend on
 * whether the test build happens to have ingest configured at all.
 * `getExpressLaneVariant` therefore falls back to parsing `exp`/`v` off the
 * current URL directly when nothing is cached, so the link's variant always
 * takes effect -- measured via `experimentRef`/`variant` on product events
 * where ingest is configured, and just by which screen the maker describes
 * in the post-session form where it isn't.
 */
import { VARIANT_PATTERN } from '@/analytics/contract';
import { getCachedExperiment } from '@/analytics/source';

/** The one place this experiment's ref is spelled out. */
export const EXPRESS_LANE_EXPERIMENT_REF = 'EXP-011';

export type ExpressLaneVariant = 'rail' | 'express';

/** Both variant slugs satisfy the contract's `VARIANT_PATTERN`; asserted in
 * `__tests__/expressLane.test.ts` so a future rename can't quietly produce
 * a value the ingest server rejects the whole event for. */
export const EXPRESS_LANE_VARIANTS: readonly ExpressLaneVariant[] = ['rail', 'express'];

function parseVariantFromSearch(search: string): ExpressLaneVariant {
  const params = new URLSearchParams(search);
  if (params.get('exp') !== EXPRESS_LANE_EXPERIMENT_REF) return 'rail';
  const variantRaw = params.get('v');
  if (!variantRaw || !VARIANT_PATTERN.test(variantRaw)) return 'rail';
  return EXPRESS_LANE_VARIANTS.find((candidate) => candidate === variantRaw) ?? 'rail';
}

/**
 * The variant this session is in, for the UI to branch on. Prefers the
 * sessionStorage cache `captureLandingContext()` already populated for a
 * configured, GPC-absent session (so it agrees with whatever `experimentRef`
 * product events carry); falls back to parsing the live `location.search`
 * directly, which is what keeps the link effective in an unconfigured test
 * build or under GPC -- see the module doc comment above. Defaults to
 * `rail` -- today's gated rail -- whenever neither source names EXP-011,
 * same as every other session not recruited into this experiment.
 */
export function getExpressLaneVariant(
  storage: Storage = window.sessionStorage,
  search: string = window.location.search,
): ExpressLaneVariant {
  const cached = getCachedExperiment(storage);
  if (cached.experimentRef === EXPRESS_LANE_EXPERIMENT_REF) {
    return EXPRESS_LANE_VARIANTS.find((candidate) => candidate === cached.variant) ?? 'rail';
  }
  if (cached.experimentRef !== undefined) return 'rail'; // a link put this session in another experiment
  return parseVariantFromSearch(search);
}
