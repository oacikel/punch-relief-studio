/**
 * localStorage flag for EXP-004 ("Show a first-project guide after
 * import"): tracks whether this browser has already dismissed the
 * Workspace first-project guide, so it only ever shows once per device,
 * not once per session/project. Follows the same injectable-`Storage`
 * convention as `calibrationStore.ts` for testability.
 */
const STORAGE_KEY = 'punch-relief-studio:first-project-guide-seen:v1';

export function hasSeenFirstProjectGuide(storage: Storage = window.localStorage): boolean {
  try {
    return storage.getItem(STORAGE_KEY) === '1';
  } catch {
    // Corrupt/unavailable storage should never crash the app -- fall back
    // to "not seen" so the guide can still show.
    return false;
  }
}

export function markFirstProjectGuideSeen(storage: Storage = window.localStorage): void {
  try {
    storage.setItem(STORAGE_KEY, '1');
  } catch {
    // Ignore quota/availability errors -- worst case the guide reappears.
  }
}
