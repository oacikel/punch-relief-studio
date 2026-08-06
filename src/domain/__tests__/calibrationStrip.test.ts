import { describe, expect, it } from 'vitest';
import { createDefaultProfile } from '../calibration';
import { generateCalibrationStrip } from '../calibrationStrip';

describe('generateCalibrationStrip', () => {
  it('produces one block per needle setting', () => {
    const profile = createDefaultProfile();
    const strip = generateCalibrationStrip(profile);
    expect(strip.blockCount).toBe(profile.settings.length);
  });

  it('produces valid, non-empty SVG markup', () => {
    const strip = generateCalibrationStrip(createDefaultProfile());
    expect(strip.svg).toContain('<svg');
    expect(strip.svg).toContain('</svg>');
    expect(strip.svg.length).toBeGreaterThan(100);
  });

  it('scales width with the number of settings', () => {
    const small = generateCalibrationStrip(createDefaultProfile());
    const profile = createDefaultProfile();
    profile.settings.push({ settingNumber: 5, label: 'extra', measuredHeightCm: null });
    const large = generateCalibrationStrip(profile);
    expect(large.widthCm).toBeGreaterThan(small.widthCm);
  });
});
