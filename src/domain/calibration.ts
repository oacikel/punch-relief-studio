/**
 * Needle / pile-height calibration profiles. A profile maps numbered
 * needle settings to (optionally) a measured pile height. The default
 * profile is explicitly uncalibrated -- see CLAUDE.md "Important product
 * constraints": never label an uncalibrated level with a fake mm value.
 */
import type { Cm } from './units';

export interface NeedleSetting {
  settingNumber: number;
  label: string; // e.g. "low", "medium-low"
  /** Measured pile height, if the user has calibrated this setting. */
  measuredHeightCm: Cm | null;
}

export interface CalibrationProfile {
  schemaVersion: 1;
  id: string;
  profileName: string;
  needleName: string;
  yarnName: string;
  yarnThickness: string;
  fabricMaterial: string;
  settings: NeedleSetting[];
  notes: string;
  calibrated: boolean; // false until at least one setting has a measured height
}

export function createDefaultProfile(): CalibrationProfile {
  return {
    schemaVersion: 1,
    id: 'default-uncalibrated',
    profileName: 'Generic (uncalibrated)',
    needleName: 'Generic adjustable punch needle',
    yarnName: 'Generic worsted weight',
    yarnThickness: 'medium',
    fabricMaterial: 'monk’s cloth',
    notes:
      'Default profile with no measured heights. Levels are ordered low to high only ' +
      '-- they do not represent real millimetre measurements until you calibrate.',
    calibrated: false,
    settings: [
      { settingNumber: 1, label: 'low', measuredHeightCm: null },
      { settingNumber: 2, label: 'medium-low', measuredHeightCm: null },
      { settingNumber: 3, label: 'medium-high', measuredHeightCm: null },
      { settingNumber: 4, label: 'high', measuredHeightCm: null },
    ],
  };
}

export interface ValidationError {
  field: string;
  message: string;
}

export function validateProfile(profile: CalibrationProfile): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!profile.profileName.trim()) errors.push({ field: 'profileName', message: 'Profile name is required.' });
  if (profile.settings.length === 0) {
    errors.push({ field: 'settings', message: 'At least one needle setting is required.' });
  }
  const seen = new Set<number>();
  for (const s of profile.settings) {
    if (seen.has(s.settingNumber)) {
      errors.push({ field: 'settings', message: `Duplicate setting number ${s.settingNumber}.` });
    }
    seen.add(s.settingNumber);
    if (s.measuredHeightCm !== null) {
      if (!Number.isFinite(s.measuredHeightCm) || s.measuredHeightCm <= 0) {
        errors.push({
          field: `settings[${s.settingNumber}].measuredHeightCm`,
          message: 'Measured height must be a positive number of centimetres.',
        });
      }
      if (s.measuredHeightCm > 5) {
        errors.push({
          field: `settings[${s.settingNumber}].measuredHeightCm`,
          message: 'Measured height over 5cm is almost certainly a units mistake (expected cm, not mm).',
        });
      }
    }
  }
  return errors;
}

export function isCalibrated(profile: CalibrationProfile): boolean {
  return profile.settings.some((s) => s.measuredHeightCm !== null);
}

/**
 * Map a 0-based generated height level index onto a needle setting from the
 * profile, distributing levels evenly across available settings when the
 * counts differ.
 */
export function mapHeightLevelToSetting(
  heightLevelIndex: number,
  levelCount: number,
  profile: CalibrationProfile,
): NeedleSetting {
  const settings = [...profile.settings].sort((a, b) => a.settingNumber - b.settingNumber);
  if (settings.length === 0) throw new Error('Profile has no needle settings.');
  const ratio = heightLevelIndex / Math.max(1, levelCount - 1);
  const idx = Math.round(ratio * (settings.length - 1));
  return settings[Math.min(settings.length - 1, Math.max(0, idx))] as NeedleSetting;
}
