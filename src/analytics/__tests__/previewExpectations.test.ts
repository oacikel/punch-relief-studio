import { afterEach, describe, expect, it } from 'vitest';
import { EXPERIMENT_REF_PATTERN, VARIANT_PATTERN } from '@/analytics/contract';
import {
  PREVIEW_EXPECTATIONS_EXPERIMENT_REF,
  PREVIEW_EXPECTATIONS_VARIANTS,
  assignPreviewExpectationsExperiment,
  getPreviewExpectationsVariant,
  pickPreviewExpectationsVariant,
} from '@/analytics/previewExpectations';
import { captureLandingContext, getCachedExperiment } from '@/analytics/source';

/**
 * EXP-003 ("clarify the single-viewpoint preview"): the variant assignment,
 * which is what makes every product event of the session carry
 * `experimentRef: 'EXP-003'` without touching a single `track*` call site.
 */
describe('EXP-003 preview-expectations assignment', () => {
  afterEach(() => {
    window.sessionStorage.clear();
    window.history.pushState({}, '', '/');
  });

  it('uses values the ingest contract accepts', () => {
    expect(EXPERIMENT_REF_PATTERN.test(PREVIEW_EXPECTATIONS_EXPERIMENT_REF)).toBe(true);
    for (const variant of PREVIEW_EXPECTATIONS_VARIANTS) {
      expect(VARIANT_PATTERN.test(variant)).toBe(true);
    }
  });

  it('enrolls the session in EXP-003 with one of the two variants', () => {
    assignPreviewExpectationsExperiment();

    const cached = getCachedExperiment();
    expect(cached.experimentRef).toBe('EXP-003');
    expect(PREVIEW_EXPECTATIONS_VARIANTS).toContain(cached.variant);
  });

  it('keeps the same variant for the rest of the session', () => {
    assignPreviewExpectationsExperiment(window.sessionStorage, 'control');
    assignPreviewExpectationsExperiment(window.sessionStorage, 'expectations');

    expect(getCachedExperiment()).toEqual({ experimentRef: 'EXP-003', variant: 'control' });
    expect(getPreviewExpectationsVariant()).toBe('control');
  });

  it('never overwrites an experiment the landing link already put the session in', () => {
    window.history.pushState({}, '', '/?exp=EXP-002&v=b');
    captureLandingContext();

    assignPreviewExpectationsExperiment(window.sessionStorage, 'control');

    expect(getCachedExperiment()).toEqual({ experimentRef: 'EXP-002', variant: 'b' });
    // Not in EXP-003 at all, so the notice is shown rather than withheld --
    // the control group only exists where EXP-003 is being measured.
    expect(getPreviewExpectationsVariant()).toBe('expectations');
  });

  it('still assigns EXP-003 when landing context was captured without an experiment link', () => {
    captureLandingContext();
    expect(getCachedExperiment()).toEqual({});

    assignPreviewExpectationsExperiment(window.sessionStorage, 'control');

    expect(getCachedExperiment()).toEqual({ experimentRef: 'EXP-003', variant: 'control' });
  });

  it('reports the expectations variant when nothing has been assigned', () => {
    expect(getPreviewExpectationsVariant()).toBe('expectations');
  });

  it('reports the expectations variant when EXP-003 is cached with an unknown variant', () => {
    window.sessionStorage.setItem(
      'prs:analytics:experiment:v1',
      JSON.stringify({ experimentRef: 'EXP-003', variant: 'something-else' }),
    );
    expect(getPreviewExpectationsVariant()).toBe('expectations');
  });

  it('splits variants on the parity of the random draw', () => {
    expect(pickPreviewExpectationsVariant('0abc')).toBe('control');
    expect(pickPreviewExpectationsVariant('eabc')).toBe('control');
    expect(pickPreviewExpectationsVariant('1abc')).toBe('expectations');
    expect(pickPreviewExpectationsVariant('fabc')).toBe('expectations');
    // A draw that can't be read as hex must still produce a valid variant
    // rather than NaN-ing into an invalid one.
    expect(PREVIEW_EXPECTATIONS_VARIANTS).toContain(pickPreviewExpectationsVariant(''));
  });

  it('draws both variants over many assignments', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      window.sessionStorage.clear();
      assignPreviewExpectationsExperiment();
      seen.add(getPreviewExpectationsVariant());
    }
    expect([...seen].sort()).toEqual(['control', 'expectations']);
  });
});
