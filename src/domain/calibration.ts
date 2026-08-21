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

/** Needle-setting count bounds, matching the widened height-levels range
 * (2-12, see docs/DECISIONS.md) -- a profile with more settings than a
 * pattern has levels is harmless (`mapHeightLevelToSetting` simply never
 * reaches the extras), but there is no point going past 12. Exported so
 * `CalibrationEditor.tsx` can disable its Add/Remove buttons at the same
 * bounds `validateProfile` enforces, without duplicating the numbers. */
export const MIN_NEEDLE_SETTINGS = 1;
export const MAX_NEEDLE_SETTINGS = 12;

export interface ValidationError {
  field: string;
  message: string;
}

export function validateProfile(profile: CalibrationProfile): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!profile.profileName.trim())
    errors.push({ field: 'profileName', message: 'Profile name is required.' });
  if (profile.settings.length === 0) {
    errors.push({ field: 'settings', message: 'At least one needle setting is required.' });
  }
  if (profile.settings.length > MAX_NEEDLE_SETTINGS) {
    errors.push({
      field: 'settings',
      message: `A profile can have at most ${MAX_NEEDLE_SETTINGS} needle settings.`,
    });
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
          message:
            'Measured height over 5cm is almost certainly a units mistake (expected cm, not mm).',
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
 * Append a new needle setting, numbered one past the current highest
 * `settingNumber` (not renumbered/compacted on removal -- `settingNumber`
 * is treated as a stable identifier elsewhere, e.g. `mapHeightLevelToSetting`
 * only sorts by it, never assumes contiguity). A no-op past
 * `MAX_NEEDLE_SETTINGS` -- callers (e.g. `CalibrationEditor`) should also
 * disable the triggering control at that bound, this is a defensive floor,
 * not the only enforcement (see `validateProfile`, which flags is already
 * over the cap for direct JSON import too). Pure and domain-only per
 * CLAUDE.md -- profile-mutation rules live here, not inline in the editor
 * component.
 */
export function addNeedleSetting(profile: CalibrationProfile): CalibrationProfile {
  if (profile.settings.length >= MAX_NEEDLE_SETTINGS) return profile;
  const nextNumber = profile.settings.reduce((max, s) => Math.max(max, s.settingNumber), 0) + 1;
  return {
    ...profile,
    settings: [
      ...profile.settings,
      { settingNumber: nextNumber, label: `Setting ${nextNumber}`, measuredHeightCm: null },
    ],
  };
}

/**
 * Remove one needle setting by number. A no-op at or below
 * `MIN_NEEDLE_SETTINGS` -- a profile always needs at least one setting for
 * `mapHeightLevelToSetting` to have anything to map onto.
 */
export function removeNeedleSetting(
  profile: CalibrationProfile,
  settingNumber: number,
): CalibrationProfile {
  if (profile.settings.length <= MIN_NEEDLE_SETTINGS) return profile;
  return {
    ...profile,
    settings: profile.settings.filter((s) => s.settingNumber !== settingNumber),
  };
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
