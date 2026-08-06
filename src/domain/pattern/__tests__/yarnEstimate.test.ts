import { describe, expect, it } from 'vitest';
import { createDefaultProfile } from '../../calibration';
import { cm } from '../../units';
import { estimateYarnForRegion } from '../yarnEstimate';

describe('estimateYarnForRegion', () => {
  it('returns a positive estimate with documented assumptions', () => {
    const profile = createDefaultProfile();
    const result = estimateYarnForRegion({
      regionAreaCm2: 10,
      heightLevelIndex: 1,
      levelCount: 4,
      profile,
    });
    expect(result.meters).toBeGreaterThan(0);
    expect(result.assumptions.length).toBeGreaterThan(0);
  });

  it('flags when the estimate is using an uncalibrated placeholder height', () => {
    const profile = createDefaultProfile();
    const result = estimateYarnForRegion({ regionAreaCm2: 5, heightLevelIndex: 0, levelCount: 4, profile });
    expect(result.assumptions.some((a) => a.toLowerCase().includes('not calibrated'))).toBe(true);
  });

  it('uses the calibrated measured height when available, changing the estimate', () => {
    const profile = createDefaultProfile();
    profile.settings[0] = { ...profile.settings[0], measuredHeightCm: cm(2) };
    const calibrated = estimateYarnForRegion({ regionAreaCm2: 5, heightLevelIndex: 0, levelCount: 4, profile });
    const uncalibratedProfile = createDefaultProfile();
    const uncalibrated = estimateYarnForRegion({
      regionAreaCm2: 5,
      heightLevelIndex: 0,
      levelCount: 4,
      profile: uncalibratedProfile,
    });
    expect(calibrated.meters).not.toBeCloseTo(uncalibrated.meters, 5);
  });

  it('scales roughly linearly with region area', () => {
    const profile = createDefaultProfile();
    const small = estimateYarnForRegion({ regionAreaCm2: 5, heightLevelIndex: 1, levelCount: 4, profile });
    const large = estimateYarnForRegion({ regionAreaCm2: 10, heightLevelIndex: 1, levelCount: 4, profile });
    expect(large.meters).toBeCloseTo(small.meters * 2, 5);
  });
});
