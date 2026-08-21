import { describe, expect, it } from 'vitest';
import {
  addNeedleSetting,
  createDefaultProfile,
  isCalibrated,
  mapHeightLevelToSetting,
  MAX_NEEDLE_SETTINGS,
  MIN_NEEDLE_SETTINGS,
  removeNeedleSetting,
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

  it('accepts up to 12 needle settings', () => {
    const profile = createDefaultProfile();
    profile.settings = Array.from({ length: 12 }, (_, i) => ({
      settingNumber: i + 1,
      label: `Setting ${i + 1}`,
      measuredHeightCm: null,
    }));
    expect(validateProfile(profile)).toHaveLength(0);
  });

  it('flags more than 12 needle settings', () => {
    const profile = createDefaultProfile();
    profile.settings = Array.from({ length: 13 }, (_, i) => ({
      settingNumber: i + 1,
      label: `Setting ${i + 1}`,
      measuredHeightCm: null,
    }));
    expect(validateProfile(profile).some((e) => e.message.includes('at most 12'))).toBe(true);
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

describe('addNeedleSetting / removeNeedleSetting (Iteration 02 Stage B)', () => {
  it('appends a new setting numbered one past the current highest', () => {
    const profile = createDefaultProfile(); // settings 1-4
    const updated = addNeedleSetting(profile);
    expect(updated.settings).toHaveLength(5);
    expect(updated.settings[4]).toEqual({
      settingNumber: 5,
      label: 'Setting 5',
      measuredHeightCm: null,
    });
  });

  it('is a no-op once a profile already has the maximum number of settings', () => {
    const profile = createDefaultProfile();
    profile.settings = Array.from({ length: MAX_NEEDLE_SETTINGS }, (_, i) => ({
      settingNumber: i + 1,
      label: `Setting ${i + 1}`,
      measuredHeightCm: null,
    }));
    const updated = addNeedleSetting(profile);
    expect(updated.settings).toHaveLength(MAX_NEEDLE_SETTINGS);
  });

  it('removes the setting matching the given number, leaving others untouched', () => {
    const profile = createDefaultProfile(); // settings 1-4
    const updated = removeNeedleSetting(profile, 2);
    expect(updated.settings.map((s) => s.settingNumber)).toEqual([1, 3, 4]);
  });

  it('is a no-op once a profile is down to the minimum number of settings', () => {
    const profile = createDefaultProfile();
    profile.settings = [{ settingNumber: 1, label: 'only', measuredHeightCm: null }];
    const updated = removeNeedleSetting(profile, 1);
    expect(updated.settings).toHaveLength(MIN_NEEDLE_SETTINGS);
  });

  it('does not renumber survivors, since settingNumber is a stable identifier elsewhere', () => {
    const profile = createDefaultProfile();
    const afterRemove = removeNeedleSetting(profile, 1);
    const afterAdd = addNeedleSetting(afterRemove);
    // Removing #1 then adding should number the new one 5 (one past the
    // remaining highest, 4), not renumber down to fill the gap left by #1.
    expect(afterAdd.settings.map((s) => s.settingNumber)).toEqual([2, 3, 4, 5]);
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
