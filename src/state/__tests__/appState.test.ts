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
});
