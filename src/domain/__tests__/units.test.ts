import { describe, expect, it } from 'vitest';
import { cm, cmToInch, cmToPx, inch, inchToCm, pxToCm, clamp, clamp01 } from '../units';

describe('unit conversion', () => {
  it('round-trips cm <-> inch', () => {
    const value = cm(10);
    const asInch = cmToInch(value);
    expect(asInch).toBeCloseTo(3.937, 3);
    expect(inchToCm(asInch)).toBeCloseTo(10, 6);
  });

  it('converts cm to px using explicit density', () => {
    expect(cmToPx(cm(2), 10)).toBe(20);
  });

  it('converts px back to cm using the same density', () => {
    expect(pxToCm(cmToPx(cm(5), 12), 12)).toBeCloseTo(5, 6);
  });

  it('throws for non-positive pxPerCm', () => {
    expect(() => pxToCm(cmToPx(cm(1), 10), 0)).toThrow();
  });

  it('clamp01 clamps and handles NaN', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(NaN)).toBe(0);
  });

  it('clamp respects arbitrary bounds', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-5, 0, 3)).toBe(0);
  });

  it('inch() is a plain numeric brand', () => {
    expect(Number(inch(1))).toBe(1);
  });
});
