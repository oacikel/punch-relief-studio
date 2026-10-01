import { afterEach, describe, expect, it } from 'vitest';
import { EXPERIMENT_REF_PATTERN, VARIANT_PATTERN } from '@/analytics/contract';
import {
  FIT_TO_SCREEN_PREVIEW_EXPERIMENT_REF,
  FIT_TO_SCREEN_PREVIEW_VARIANTS,
  assignFitToScreenPreviewExperiment,
} from '@/analytics/fitToScreenPreview';
import { captureLandingContext, getCachedExperiment } from '@/analytics/source';

/**
 * EXP-007 ("ship fit-to-screen default plus pan and zoom as a standalone
 * release"): the self-assignment, which is what makes every product event
 * of a release-window session carry `experimentRef: 'EXP-007'` without
 * touching a single `track*` call site -- see docs/ANALYTICS.md for why
 * this is a single-variant, pre/post-window measurement rather than an A/B
 * split.
 */
describe('EXP-007 fit-to-screen preview assignment', () => {
  afterEach(() => {
    window.sessionStorage.clear();
    window.history.pushState({}, '', '/');
  });

  it('uses values the ingest contract accepts', () => {
    expect(EXPERIMENT_REF_PATTERN.test(FIT_TO_SCREEN_PREVIEW_EXPERIMENT_REF)).toBe(true);
    for (const variant of FIT_TO_SCREEN_PREVIEW_VARIANTS) {
      expect(VARIANT_PATTERN.test(variant)).toBe(true);
    }
  });

  it('enrolls the session in EXP-007 with the single fit variant', () => {
    assignFitToScreenPreviewExperiment();

    expect(getCachedExperiment()).toEqual({ experimentRef: 'EXP-007', variant: 'fit' });
  });

  it('is idempotent within a session', () => {
    assignFitToScreenPreviewExperiment();
    assignFitToScreenPreviewExperiment();

    expect(getCachedExperiment()).toEqual({ experimentRef: 'EXP-007', variant: 'fit' });
  });

  it('never overwrites an experiment the landing link already put the session in', () => {
    window.history.pushState({}, '', '/?exp=EXP-002&v=b');
    captureLandingContext();

    assignFitToScreenPreviewExperiment();

    expect(getCachedExperiment()).toEqual({ experimentRef: 'EXP-002', variant: 'b' });
  });

  it('still assigns EXP-007 when landing context was captured without an experiment link', () => {
    captureLandingContext();
    expect(getCachedExperiment()).toEqual({});

    assignFitToScreenPreviewExperiment();

    expect(getCachedExperiment()).toEqual({ experimentRef: 'EXP-007', variant: 'fit' });
  });
});
