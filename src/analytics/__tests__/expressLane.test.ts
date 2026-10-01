import { afterEach, describe, expect, it } from 'vitest';
import { EXPERIMENT_REF_PATTERN, VARIANT_PATTERN } from '@/analytics/contract';
import {
  EXPRESS_LANE_EXPERIMENT_REF,
  EXPRESS_LANE_VARIANTS,
  getExpressLaneVariant,
} from '@/analytics/expressLane';
import { captureLandingContext, getCachedExperiment, writeExperimentContext } from '@/analytics/source';

/**
 * EXP-011 ("Express lane: one screen from import to export, with Export
 * always visible"): link-only, so there is no 50/50 assignment to test --
 * just that a `?exp=EXP-011&v=...` link resolves to the right variant, with
 * or without a configured/cached landing context, and that an unrelated or
 * absent link falls back to `rail` (today's gated three-step rail).
 */
describe('EXP-011 express-lane variant', () => {
  afterEach(() => {
    window.sessionStorage.clear();
    window.history.pushState({}, '', '/');
  });

  it('uses values the ingest contract accepts', () => {
    expect(EXPERIMENT_REF_PATTERN.test(EXPRESS_LANE_EXPERIMENT_REF)).toBe(true);
    for (const variant of EXPRESS_LANE_VARIANTS) {
      expect(VARIANT_PATTERN.test(variant)).toBe(true);
    }
  });

  it('defaults to rail when nothing names EXP-011', () => {
    expect(getExpressLaneVariant()).toBe('rail');
  });

  it('reads the express variant straight off the URL, with no analytics cache involved', () => {
    expect(getExpressLaneVariant(window.sessionStorage, '?exp=EXP-011&v=express')).toBe('express');
  });

  it('reads the rail variant straight off the URL', () => {
    expect(getExpressLaneVariant(window.sessionStorage, '?exp=EXP-011&v=rail')).toBe('rail');
  });

  it('falls back to rail for an unknown variant slug', () => {
    expect(getExpressLaneVariant(window.sessionStorage, '?exp=EXP-011&v=something-else')).toBe(
      'rail',
    );
  });

  it('ignores a link for a different experiment', () => {
    expect(getExpressLaneVariant(window.sessionStorage, '?exp=EXP-002&v=express')).toBe('rail');
  });

  it('prefers a cached landing context over the live URL once captured', () => {
    window.history.pushState({}, '', '/?exp=EXP-011&v=express');
    captureLandingContext();

    // The query string changing later (e.g. in-app navigation) shouldn't
    // flip the variant mid-session -- the cache from the original landing
    // link wins.
    expect(getExpressLaneVariant(window.sessionStorage, '?exp=EXP-011&v=rail')).toBe('express');
  });

  it('falls back to the live URL when analytics is unconfigured, so the link still works', () => {
    // Nothing cached (captureLandingContext never ran -- the unconfigured-
    // build path) is exactly the case the task brief's "otherwise tally by
    // hand" fallback needs covered.
    expect(getCachedExperiment()).toEqual({});
    expect(getExpressLaneVariant(window.sessionStorage, '?exp=EXP-011&v=express')).toBe('express');
  });

  it('reports rail when a link already put the session in a different experiment', () => {
    writeExperimentContext({ experimentRef: 'EXP-777', variant: 'b' });
    expect(getExpressLaneVariant(window.sessionStorage, '?exp=EXP-011&v=express')).toBe('rail');
  });

  it('reports rail when EXP-011 is cached with an unknown variant', () => {
    writeExperimentContext({ experimentRef: 'EXP-011', variant: 'something-else' });
    expect(getExpressLaneVariant()).toBe('rail');
  });
});
