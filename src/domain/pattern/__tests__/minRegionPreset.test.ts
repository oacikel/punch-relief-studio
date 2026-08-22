import { describe, expect, it } from 'vitest';
import {
  MIN_REGION_PRESET_ORDER,
  minRegionPxForPreset,
  type MinRegionPreset,
} from '../minRegionPreset';

describe('minRegionPxForPreset', () => {
  it('orders presets from smallest to largest threshold at a fixed resolution', () => {
    const pxByPreset = MIN_REGION_PRESET_ORDER.map((preset) =>
      minRegionPxForPreset(preset, 256, 256),
    );
    expect(pxByPreset[0]).toBeLessThan(pxByPreset[1] as number);
    expect(pxByPreset[1]).toBeLessThan(pxByPreset[2] as number);
  });

  it("'balanced' at the default 256x256 resolution is close to the previous fixed default (12px)", () => {
    const px = minRegionPxForPreset('balanced', 256, 256);
    expect(px).toBeGreaterThan(6);
    expect(px).toBeLessThan(20);
  });

  it('scales with canvas area, staying meaningful at other resolutions', () => {
    const small = minRegionPxForPreset('balanced', 128, 128);
    const large = minRegionPxForPreset('balanced', 512, 512);
    expect(large).toBeGreaterThan(small);
    // Quadrupling each dimension (16x area) should roughly 16x the pixel
    // threshold, not stay fixed.
    expect(large / small).toBeGreaterThan(10);
  });

  it('never goes below 1px, even for a tiny canvas', () => {
    const presets: MinRegionPreset[] = ['fine', 'balanced', 'bold'];
    for (const preset of presets) {
      expect(minRegionPxForPreset(preset, 4, 4)).toBeGreaterThanOrEqual(1);
    }
  });

  it('is deterministic for the same inputs', () => {
    expect(minRegionPxForPreset('bold', 300, 200)).toBe(minRegionPxForPreset('bold', 300, 200));
  });
});
