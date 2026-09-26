/**
 * Consent state. Nothing is stored or sent until the user clicks Allow in
 * the consent prompt (`PrivacyControl.tsx`). The browser's Global Privacy
 * Control signal counts as a standing "No" and suppresses the prompt
 * entirely -- see docs/DECISIONS.md.
 */
const CONSENT_STORAGE_KEY = 'prs:analytics:consent:v1';

export type ConsentState = 'unknown' | 'granted' | 'denied';

/** `navigator.globalPrivacyControl` isn't in TypeScript's DOM lib yet;
 * declared locally rather than widening the global `Navigator` type
 * project-wide for a single read site. */
function hasGlobalPrivacyControl(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true
  );
}

export { hasGlobalPrivacyControl };

export function getConsentState(storage: Storage = window.localStorage): ConsentState {
  if (hasGlobalPrivacyControl()) return 'denied';
  const raw = storage.getItem(CONSENT_STORAGE_KEY);
  if (raw === 'granted') return 'granted';
  if (raw === 'denied') return 'denied';
  return 'unknown';
}

export function setConsentGranted(storage: Storage = window.localStorage): void {
  storage.setItem(CONSENT_STORAGE_KEY, 'granted');
}

export function setConsentDenied(storage: Storage = window.localStorage): void {
  storage.setItem(CONSENT_STORAGE_KEY, 'denied');
}

export function clearConsent(storage: Storage = window.localStorage): void {
  storage.removeItem(CONSENT_STORAGE_KEY);
}
