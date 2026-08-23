import { describe, expect, it } from 'vitest';
import { appReducer, initialAppState } from '../appState';

describe('appReducer', () => {
  it('starts with a single default swatch and uncalibrated profile', () => {
    const state = initialAppState();
    expect(state.swatches).toHaveLength(1);
    expect(state.calibrationProfile.calibrated).toBe(false);
  });

  it('SET_RELIEF_SETTINGS merges rather than replaces', () => {
    const state = initialAppState();
    const next = appReducer(state, { type: 'SET_RELIEF_SETTINGS', settings: { levels: 6 } });
    expect(next.reliefSettings.levels).toBe(6);
    expect(next.reliefSettings.intensity).toBe(state.reliefSettings.intensity);
  });

  it('SET_SOURCE clears any previously processed result', () => {
    let state = initialAppState();
    state = appReducer(state, {
      type: 'PROCESSING_SUCCEEDED',
      result: {
        width: 2,
        height: 2,
        heightIndex: new Int16Array(4),
        colorIndex: new Int16Array(4),
        levels: [],
      },
    });
    expect(state.processed).not.toBeNull();
    state = appReducer(state, { type: 'SET_SOURCE', sourceKind: 'built-in-sample', sampleId: 'x' });
    expect(state.processed).toBeNull();
  });

  it('PROCESSING_FAILED clears the processing flag and records a message', () => {
    let state = initialAppState();
    state = appReducer(state, { type: 'PROCESSING_STARTED' });
    state = appReducer(state, { type: 'PROCESSING_FAILED', message: 'boom' });
    expect(state.processing).toBe(false);
    expect(state.processingError).toBe('boom');
  });

  it('defaults needleGeometry to "not set" (0, 0)', () => {
    const state = initialAppState();
    expect(state.needleGeometry).toEqual({ diameterMm: 0, throwMm: 0 });
  });

  it('SET_NEEDLE_GEOMETRY merges rather than replaces', () => {
    let state = initialAppState();
    state = appReducer(state, { type: 'SET_NEEDLE_GEOMETRY', geometry: { diameterMm: 2 } });
    expect(state.needleGeometry).toEqual({ diameterMm: 2, throwMm: 0 });
    state = appReducer(state, { type: 'SET_NEEDLE_GEOMETRY', geometry: { throwMm: 40 } });
    expect(state.needleGeometry).toEqual({ diameterMm: 2, throwMm: 40 });
  });
});

describe('patternViewSettings (Iteration 02 Stage C)', () => {
  it('defaults to on-screen labels visible and no punch guide', () => {
    const state = initialAppState();
    expect(state.patternViewSettings.showOnScreenLabels).toBe(true);
    expect(state.patternViewSettings.punchGuide).toEqual({ mode: 'none', spacingCm: 1 });
  });

  it('SET_PATTERN_VIEW_SETTINGS updates showOnScreenLabels without touching punchGuide', () => {
    const state = initialAppState();
    const next = appReducer(state, {
      type: 'SET_PATTERN_VIEW_SETTINGS',
      showOnScreenLabels: false,
    });
    expect(next.patternViewSettings.showOnScreenLabels).toBe(false);
    expect(next.patternViewSettings.punchGuide).toEqual(state.patternViewSettings.punchGuide);
  });

  it('SET_PATTERN_VIEW_SETTINGS updates punchGuide.mode without touching punchGuide.spacingCm', () => {
    const state = initialAppState();
    const next = appReducer(state, {
      type: 'SET_PATTERN_VIEW_SETTINGS',
      punchGuide: { mode: 'dots' },
    });
    expect(next.patternViewSettings.punchGuide.mode).toBe('dots');
    expect(next.patternViewSettings.punchGuide.spacingCm).toBe(
      state.patternViewSettings.punchGuide.spacingCm,
    );
    // Unrelated field untouched by a punchGuide-only patch.
    expect(next.patternViewSettings.showOnScreenLabels).toBe(true);
  });

  it('SET_PATTERN_VIEW_SETTINGS updates punchGuide.spacingCm without resetting mode', () => {
    let state = initialAppState();
    state = appReducer(state, { type: 'SET_PATTERN_VIEW_SETTINGS', punchGuide: { mode: 'dots' } });
    state = appReducer(state, {
      type: 'SET_PATTERN_VIEW_SETTINGS',
      punchGuide: { spacingCm: 2.5 },
    });
    expect(state.patternViewSettings.punchGuide).toEqual({ mode: 'dots', spacingCm: 2.5 });
  });

  it('an empty-patch SET_PATTERN_VIEW_SETTINGS action is a no-op', () => {
    const state = initialAppState();
    const next = appReducer(state, { type: 'SET_PATTERN_VIEW_SETTINGS' });
    expect(next.patternViewSettings).toEqual(state.patternViewSettings);
  });
});
