import { describe, expect, it } from 'vitest';
import { resizePatternDimensions } from '../patternDimensions';

describe('resizePatternDimensions', () => {
  it('preserves aspect ratio when width changes', () => {
    expect(
      resizePatternDimensions({ widthCm: 20, heightCm: 10, lockAspect: true }, 'width', 30),
    ).toEqual({ widthCm: 30, heightCm: 15 });
  });

  it('preserves aspect ratio when height changes', () => {
    expect(
      resizePatternDimensions({ widthCm: 20, heightCm: 10, lockAspect: true }, 'height', 15),
    ).toEqual({ widthCm: 30, heightCm: 15 });
  });

  it('changes only one axis when aspect ratio is unlocked', () => {
    expect(
      resizePatternDimensions({ widthCm: 20, heightCm: 10, lockAspect: false }, 'width', 30),
    ).toEqual({ widthCm: 30 });
  });

  it('rejects empty, non-finite, zero, and negative sizes', () => {
    const current = { widthCm: 20, heightCm: 10, lockAspect: true };
    expect(resizePatternDimensions(current, 'width', NaN)).toBeNull();
    expect(resizePatternDimensions(current, 'width', 0)).toBeNull();
    expect(resizePatternDimensions(current, 'height', -1)).toBeNull();
  });
});
