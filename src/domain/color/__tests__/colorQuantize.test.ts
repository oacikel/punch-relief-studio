import { describe, expect, it } from 'vitest';
import { labDistance, quantizeColors, rgbToLab } from '../colorQuantize';
import type { Mask } from '../../types';

function makeMask(w: number, h: number, fg: number[]): Mask {
  return { width: w, height: h, data: Uint8Array.from(fg) };
}

describe('rgbToLab / labDistance', () => {
  it('maps black and white to L=0 and L~100', () => {
    expect(rgbToLab({ r: 0, g: 0, b: 0 }).l).toBeCloseTo(0, 1);
    expect(rgbToLab({ r: 255, g: 255, b: 255 }).l).toBeCloseTo(100, 0);
  });

  it('distance from a color to itself is 0', () => {
    const lab = rgbToLab({ r: 120, g: 80, b: 200 });
    expect(labDistance(lab, lab)).toBe(0);
  });
});

describe('quantizeColors', () => {
  it('rejects palette sizes outside 2-12', () => {
    const mask = makeMask(2, 1, [1, 1]);
    const data = new Uint8ClampedArray([255, 0, 0, 0, 255, 0]);
    expect(() => quantizeColors(data, 3, mask, 1)).toThrow(RangeError);
    expect(() => quantizeColors(data, 3, mask, 13)).toThrow(RangeError);
  });

  it('is deterministic: identical input + seed produce identical output', () => {
    const mask = makeMask(4, 1, [1, 1, 1, 1]);
    const data = new Uint8ClampedArray([255, 0, 0, 0, 255, 0, 0, 0, 255, 200, 200, 0]);
    const a = quantizeColors(data, 3, mask, 3, 42);
    const b = quantizeColors(data, 3, mask, 3, 42);
    expect(a.palette).toEqual(b.palette);
    expect(Array.from(a.assignment)).toEqual(Array.from(b.assignment));
  });

  it('assigns -1 to background pixels', () => {
    const mask = makeMask(2, 1, [1, 0]);
    const data = new Uint8ClampedArray([255, 0, 0, 0, 0, 0]);
    const result = quantizeColors(data, 3, mask, 2, 1);
    expect(result.assignment[1]).toBe(-1);
  });

  it('returns an empty palette when there are no foreground pixels', () => {
    const mask = makeMask(2, 1, [0, 0]);
    const data = new Uint8ClampedArray([0, 0, 0, 0, 0, 0]);
    const result = quantizeColors(data, 3, mask, 2, 1);
    expect(result.palette).toHaveLength(0);
  });

  it('clusters near-identical colors to a small palette', () => {
    const mask = makeMask(4, 1, [1, 1, 1, 1]);
    // Two near-red, two near-blue.
    const data = new Uint8ClampedArray([250, 5, 5, 245, 3, 8, 5, 5, 250, 8, 3, 245]);
    const result = quantizeColors(data, 3, mask, 2, 7);
    expect(result.assignment[0]).toBe(result.assignment[1]);
    expect(result.assignment[2]).toBe(result.assignment[3]);
    expect(result.assignment[0]).not.toBe(result.assignment[2]);
  });
});
