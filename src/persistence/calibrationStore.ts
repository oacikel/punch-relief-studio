/**
 * localStorage persistence for calibration profiles. All read/write goes
 * through here so quota/serialization failures are handled in one place
 * instead of scattered try/catch blocks in components.
 */
import type { CalibrationProfile } from '@/domain/calibration';

const STORAGE_KEY = 'punch-relief-studio:calibration-profiles:v1';

export class StorageQuotaError extends Error {
  constructor() {
    super('Your browser storage is full. Export this profile as JSON before it can be saved locally.');
    this.name = 'StorageQuotaError';
  }
}

export function loadProfiles(storage: Storage = window.localStorage): CalibrationProfile[] {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CalibrationProfile[]) : [];
  } catch {
    // Corrupt storage should never crash the app -- fall back to empty.
    return [];
  }
}

export function saveProfiles(profiles: CalibrationProfile[], storage: Storage = window.localStorage): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  } catch (err) {
    if (err instanceof DOMException && (err.name === 'QuotaExceededError' || err.code === 22)) {
      throw new StorageQuotaError();
    }
    throw err;
  }
}

export function upsertProfile(profile: CalibrationProfile, storage: Storage = window.localStorage): CalibrationProfile[] {
  const profiles = loadProfiles(storage);
  const idx = profiles.findIndex((p) => p.id === profile.id);
  if (idx >= 0) profiles[idx] = profile;
  else profiles.push(profile);
  saveProfiles(profiles, storage);
  return profiles;
}

export function deleteProfile(id: string, storage: Storage = window.localStorage): CalibrationProfile[] {
  const profiles = loadProfiles(storage).filter((p) => p.id !== id);
  saveProfiles(profiles, storage);
  return profiles;
}
