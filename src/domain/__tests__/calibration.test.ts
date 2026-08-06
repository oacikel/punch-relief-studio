import { describe, expect, it } from 'vitest';
import {
  createDefaultProfile,
  isCalibrated,
  mapHeightLevelToSetting,
  validateProfile,
  type NeedleSetting,
} from '../calibration';
import { cm } from '../units';

describe('createDefaultProfile', () => {
  it('is explicitly marked uncalibrated with 4 generic settings', () => {
    const profile = createDefaultProfile();
    expect(profile.calibrated).toBe(false);
    expect(profile.settings).toHaveLength(4);
    expect(profile.settings.every((s) => s.measuredHeightCm === null)).toBe(true);
  });
});

describe('validateProfile', () => {
  it('flags an empty profile name', () => {
    const profile = createDefaultProfile();
    profile.profileName = '  ';
    expect(validateProfile(profile).some((e) => e.field === 'profileName')).toBe(true);
  });

  it('flags duplicate setting numbers', () => {
    const profile = createDefaultProfile();
    profile.settings[1] = {
      ...(profile.settings[1] as NeedleSetting),
      settingNumber: (profile.settings[0] as NeedleSetting).settingNumber,
    };
    expect(validateProfile(profile).some((e) => e.message.includes('Duplicate'))).toBe(true);
  });

  it('flags a non-positive measured height', () => {
    const profile = createDefaultProfile();
    profile.settings[0] = { ...(profile.settings[0] as NeedleSetting), measuredHeightCm: cm(-1) };
    expect(validateProfile(profile).length).toBeGreaterThan(0);
  });

  it('flags an implausibly large measured height as a likely units mistake', () => {
    const profile = createDefaultProfile();
    profile.settings[0] = { ...(profile.settings[0] as NeedleSetting), measuredHeightCm: cm(80) };
    expect(validateProfile(profile).some((e) => e.message.includes('units mistake'))).toBe(true);
  });

  it('accepts a valid profile with no errors', () => {
    const profile = createDefaultProfile();
    profile.settings[0] = { ...(profile.settings[0] as NeedleSetting), measuredHeightCm: cm(0.6) };
    expect(validateProfile(profile)).toHaveLength(0);
  });
});

describe('isCalibrated', () => {
  it('is false until at least one setting has a measured height', () => {
    expect(isCalibrated(createDefaultProfile())).toBe(false);
  });

  it('is true once any setting has a measured height', () => {
    const profile = createDefaultProfile();
    profile.settings[0] = { ...(profile.settings[0] as NeedleSetting), measuredHeightCm: cm(0.5) };
    expect(isCalibrated(profile)).toBe(true);
  });
});

describe('mapHeightLevelToSetting', () => {
  it('maps the lowest height level to the lowest setting', () => {
    const profile = createDefaultProfile();
    const setting = mapHeightLevelToSetting(0, 4, profile);
    expect(setting.settingNumber).toBe(1);
  });

  it('maps the highest height level to the highest setting', () => {
    const profile = createDefaultProfile();
    const setting = mapHeightLevelToSetting(3, 4, profile);
    expect(setting.settingNumber).toBe(4);
  });

  it('distributes evenly when level count differs from setting count', () => {
    const profile = createDefaultProfile(); // 4 settings
    const low = mapHeightLevelToSetting(0, 8, profile);
    const high = mapHeightLevelToSetting(7, 8, profile);
    expect(low.settingNumber).toBe(1);
    expect(high.settingNumber).toBe(4);
  });
});
