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

  it('preserves small image details by default and allows disabling the rescue pass', () => {
    const state = initialAppState();
    expect(state.imageDetailSettings.preserveSmallDetails).toBe(true);
    const next = appReducer(state, {
      type: 'SET_IMAGE_DETAIL_SETTINGS',
      settings: { preserveSmallDetails: false },
    });
    expect(next.imageDetailSettings.preserveSmallDetails).toBe(false);
  });

  it('defaults colorStoryId to null', () => {
    expect(initialAppState().colorStoryId).toBeNull();
  });

  it('APPLY_COLOR_STORY sets the swatches and remembers the palette id', () => {
    const state = initialAppState();
    const next = appReducer(state, {
      type: 'APPLY_COLOR_STORY',
      paletteId: 'terrain',
      swatches: [{ index: 0, color: { r: 1, g: 2, b: 3 }, yarnName: 'Yarn 1' }],
    });
    expect(next.colorStoryId).toBe('terrain');
    expect(next.swatches[0]?.color).toEqual({ r: 1, g: 2, b: 3 });
  });

  it('SET_SWATCHES clears any previously applied color story', () => {
    let state = initialAppState();
    state = appReducer(state, {
      type: 'APPLY_COLOR_STORY',
      paletteId: 'terrain',
      swatches: state.swatches,
    });
    expect(state.colorStoryId).toBe('terrain');
    state = appReducer(state, { type: 'SET_SWATCHES', swatches: state.swatches });
    expect(state.colorStoryId).toBeNull();
  });

  it('SET_SOURCE clears any previously applied color story', () => {
    let state = initialAppState();
    state = appReducer(state, {
      type: 'APPLY_COLOR_STORY',
      paletteId: 'terrain',
      swatches: state.swatches,
    });
    state = appReducer(state, { type: 'SET_SOURCE', sourceKind: 'image-file', filename: 'x.png' });
    expect(state.colorStoryId).toBeNull();
  });

  describe('EXP-010: palette undo and reset', () => {
    const starting = [{ index: 0, color: { r: 10, g: 20, b: 30 }, yarnName: 'Yarn 1' }];
    const terrainSwatches = [{ index: 0, color: { r: 1, g: 2, b: 3 }, yarnName: 'Yarn 1' }];
    const coastalSwatches = [{ index: 0, color: { r: 4, g: 5, b: 6 }, yarnName: 'Yarn 1' }];

    it('UNDO_COLOR_STORY restores the swatches from before the last apply', () => {
      let state = initialAppState();
      state = { ...state, swatches: starting };
      state = appReducer(state, {
        type: 'APPLY_COLOR_STORY',
        paletteId: 'terrain',
        swatches: terrainSwatches,
      });
      state = appReducer(state, { type: 'UNDO_COLOR_STORY' });
      expect(state.swatches).toEqual(starting);
      expect(state.colorStoryId).toBeNull();
    });

    it('UNDO_COLOR_STORY is one level: undoing twice in a row is a no-op the second time', () => {
      let state = initialAppState();
      state = { ...state, swatches: starting };
      state = appReducer(state, {
        type: 'APPLY_COLOR_STORY',
        paletteId: 'terrain',
        swatches: terrainSwatches,
      });
      state = appReducer(state, { type: 'UNDO_COLOR_STORY' });
      const afterFirstUndo = state;
      state = appReducer(state, { type: 'UNDO_COLOR_STORY' });
      expect(state).toBe(afterFirstUndo);
    });

    it('UNDO_COLOR_STORY after two applies restores the previously active story', () => {
      let state = initialAppState();
      state = { ...state, swatches: starting };
      state = appReducer(state, {
        type: 'APPLY_COLOR_STORY',
        paletteId: 'terrain',
        swatches: terrainSwatches,
      });
      state = appReducer(state, {
        type: 'APPLY_COLOR_STORY',
        paletteId: 'coastal',
        swatches: coastalSwatches,
      });
      state = appReducer(state, { type: 'UNDO_COLOR_STORY' });
      expect(state.swatches).toEqual(terrainSwatches);
      expect(state.colorStoryId).toBe('terrain');
    });

    it('UNDO_COLOR_STORY with nothing to undo is a no-op', () => {
      const state = initialAppState();
      expect(appReducer(state, { type: 'UNDO_COLOR_STORY' })).toBe(state);
    });

    it('RESET_TO_DEFAULT_COLORS restores the starting colors regardless of how many stories were applied', () => {
      let state = initialAppState();
      state = { ...state, swatches: starting };
      state = appReducer(state, {
        type: 'APPLY_COLOR_STORY',
        paletteId: 'terrain',
        swatches: terrainSwatches,
      });
      state = appReducer(state, {
        type: 'APPLY_COLOR_STORY',
        paletteId: 'coastal',
        swatches: coastalSwatches,
      });
      state = appReducer(state, { type: 'RESET_TO_DEFAULT_COLORS' });
      expect(state.swatches).toEqual(starting);
      expect(state.colorStoryId).toBeNull();
    });

    it('RESET_TO_DEFAULT_COLORS with nothing to reset is a no-op', () => {
      const state = initialAppState();
      expect(appReducer(state, { type: 'RESET_TO_DEFAULT_COLORS' })).toBe(state);
    });

    it('a manual SET_SWATCHES edit clears the pending undo', () => {
      let state = initialAppState();
      state = { ...state, swatches: starting };
      state = appReducer(state, {
        type: 'APPLY_COLOR_STORY',
        paletteId: 'terrain',
        swatches: terrainSwatches,
      });
      state = appReducer(state, { type: 'SET_SWATCHES', swatches: terrainSwatches });
      expect(state.colorStoryUndo).toBeNull();
      expect(appReducer(state, { type: 'UNDO_COLOR_STORY' })).toBe(state);
    });

    it('SET_SOURCE clears the pending undo and reset snapshots', () => {
      let state = initialAppState();
      state = { ...state, swatches: starting };
      state = appReducer(state, {
        type: 'APPLY_COLOR_STORY',
        paletteId: 'terrain',
        swatches: terrainSwatches,
      });
      state = appReducer(state, { type: 'SET_SOURCE', sourceKind: 'image-file', filename: 'x.png' });
      expect(state.colorStoryUndo).toBeNull();
      expect(state.originalSwatches).toBeNull();
    });
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
