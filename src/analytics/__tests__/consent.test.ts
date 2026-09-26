import { afterEach, describe, expect, it } from 'vitest';
import {
  clearConsent,
  getConsentState,
  hasGlobalPrivacyControl,
  setConsentDenied,
  setConsentGranted,
} from '@/analytics/consent';

function setGpc(value: boolean | undefined): void {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  if (value === undefined) delete nav.globalPrivacyControl;
  else nav.globalPrivacyControl = value;
}

describe('consent', () => {
  afterEach(() => {
    window.localStorage.clear();
    setGpc(undefined);
  });

  it('starts unknown before any choice is made', () => {
    expect(getConsentState()).toBe('unknown');
  });

  it('records granted/denied and can be cleared back to unknown', () => {
    setConsentGranted();
    expect(getConsentState()).toBe('granted');
    setConsentDenied();
    expect(getConsentState()).toBe('denied');
    clearConsent();
    expect(getConsentState()).toBe('unknown');
  });

  it('treats Global Privacy Control as a standing denial, overriding stored consent', () => {
    setConsentGranted();
    expect(getConsentState()).toBe('granted');
    setGpc(true);
    expect(hasGlobalPrivacyControl()).toBe(true);
    expect(getConsentState()).toBe('denied');
  });

  it('is not fooled by a falsy-but-present globalPrivacyControl value', () => {
    setGpc(false);
    expect(hasGlobalPrivacyControl()).toBe(false);
    expect(getConsentState()).toBe('unknown');
  });
});
