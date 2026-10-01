import { afterEach, describe, expect, it } from 'vitest';
import { EXPERIMENT_REF_PATTERN, VARIANT_PATTERN } from '@/analytics/contract';
import {
  PALETTE_ORDER_EXPERIMENT_REF,
  PALETTE_ORDER_VARIANTS,
  assignPaletteOrderExperiment,
  getPaletteOrderVariant,
  pickPaletteOrderVariant,
} from '@/analytics/paletteOrder';
import { captureLandingContext, getCachedExperiment } from '@/analytics/source';

/**
 * EXP-002 ("move yarn palette selection earlier"): the reorder's variant
 * assignment, which is what makes every product event of the session carry
 * `experimentRef: 'EXP-002'` without touching a single `track*` call site.
 */
describe('EXP-002 palette-order assignment', () => {
  afterEach(() => {
    window.sessionStorage.clear();
    window.history.pushState({}, '', '/');
  });

  it('uses values the ingest contract accepts', () => {
    expect(EXPERIMENT_REF_PATTERN.test(PALETTE_ORDER_EXPERIMENT_REF)).toBe(true);
    for (const variant of PALETTE_ORDER_VARIANTS) {
      expect(VARIANT_PATTERN.test(variant)).toBe(true);
    }
  });

  it('enrolls the session in EXP-002 with one of the two variants', () => {
    assignPaletteOrderExperiment();

    const cached = getCachedExperiment();
    expect(cached.experimentRef).toBe('EXP-002');
    expect(PALETTE_ORDER_VARIANTS).toContain(cached.variant);
  });

  it('keeps the same variant for the rest of the session', () => {
    assignPaletteOrderExperiment(window.sessionStorage, 'earlier');
    assignPaletteOrderExperiment(window.sessionStorage, 'control');

    expect(getCachedExperiment()).toEqual({ experimentRef: 'EXP-002', variant: 'earlier' });
    expect(getPaletteOrderVariant()).toBe('earlier');
  });

  it('never overwrites an experiment the landing link already put the session in', () => {
    window.history.pushState({}, '', '/?exp=EXP-777&v=b');
    captureLandingContext();

    assignPaletteOrderExperiment(window.sessionStorage, 'earlier');

    expect(getCachedExperiment()).toEqual({ experimentRef: 'EXP-777', variant: 'b' });
    // Not in EXP-002 at all, so today's order is kept -- the control group
    // only exists where EXP-002 is being measured.
    expect(getPaletteOrderVariant()).toBe('control');
  });

  it('still assigns EXP-002 when landing context was captured without an experiment link', () => {
    captureLandingContext();
    expect(getCachedExperiment()).toEqual({});

    assignPaletteOrderExperiment(window.sessionStorage, 'earlier');

    expect(getCachedExperiment()).toEqual({ experimentRef: 'EXP-002', variant: 'earlier' });
  });

  it('reports the control variant when nothing has been assigned', () => {
    expect(getPaletteOrderVariant()).toBe('control');
  });

  it('reports the control variant when EXP-002 is cached with an unknown variant', () => {
    window.sessionStorage.setItem(
      'prs:analytics:experiment:v1',
      JSON.stringify({ experimentRef: 'EXP-002', variant: 'something-else' }),
    );
    expect(getPaletteOrderVariant()).toBe('control');
  });

  it('splits variants on the parity of the random draw', () => {
    expect(pickPaletteOrderVariant('0abc')).toBe('control');
    expect(pickPaletteOrderVariant('eabc')).toBe('control');
    expect(pickPaletteOrderVariant('1abc')).toBe('earlier');
    expect(pickPaletteOrderVariant('fabc')).toBe('earlier');
    // A draw that can't be read as hex must still produce a valid variant
    // rather than NaN-ing into an invalid one.
    expect(PALETTE_ORDER_VARIANTS).toContain(pickPaletteOrderVariant(''));
  });

  it('draws both variants over many assignments', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      window.sessionStorage.clear();
      assignPaletteOrderExperiment();
      seen.add(getPaletteOrderVariant());
    }
    expect([...seen].sort()).toEqual(['control', 'earlier']);
  });
});
