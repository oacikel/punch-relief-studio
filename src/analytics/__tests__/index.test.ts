import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetAnalyticsConfigCacheForTests } from '@/analytics/config';
import { clearConsent } from '@/analytics/consent';
import { clearQueue, loadQueue } from '@/analytics/queue';
import { resetBackoffForTests } from '@/analytics/transport';
import { resetFlushSchedulerForTests } from '@/analytics/scheduler';
import {
  allowAnalytics,
  declineAnalytics,
  initAnalytics,
  isAnalyticsAllowed,
  isAnalyticsConfigured,
  shouldShowConsentPrompt,
  trackExportSucceeded,
  trackPageViewed,
  trackProjectCreated,
} from '@/analytics/index';

function configure(): void {
  vi.stubEnv('VITE_VP_INGEST_URL', 'https://ingest.example.com');
  vi.stubEnv('VITE_VP_PROJECT_TOKEN', 'vpp_abcdefghijklmnopqrstuvwx');
  resetAnalyticsConfigCacheForTests();
}

function setGpc(value: boolean | undefined): void {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  if (value === undefined) delete nav.globalPrivacyControl;
  else nav.globalPrivacyControl = value;
}

describe('analytics public API', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    clearConsent();
    clearQueue();
    setGpc(undefined);
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    resetAnalyticsConfigCacheForTests();
    resetBackoffForTests();
    resetFlushSchedulerForTests();
  });

  describe('inert when unconfigured', () => {
    it('shows no prompt, writes nothing, and sends nothing', () => {
      expect(isAnalyticsConfigured()).toBe(false);
      expect(shouldShowConsentPrompt()).toBe(false);

      initAnalytics();
      trackPageViewed('/');
      trackProjectCreated('sample');

      expect(window.localStorage.length).toBe(0);
      expect(window.sessionStorage.length).toBe(0);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('Global Privacy Control', () => {
    it('suppresses the consent prompt and guarantees nothing is ever sent, even if Allow is invoked directly', async () => {
      configure();
      setGpc(true);
      expect(shouldShowConsentPrompt()).toBe(false);

      initAnalytics();
      // Even a direct call to allowAnalytics() (bypassing UI, which itself
      // wouldn't offer this while GPC is set) must not result in an
      // "allowed" state or any traffic -- GPC is a standing No.
      allowAnalytics();
      expect(isAnalyticsAllowed()).toBe(false);

      trackPageViewed('/');
      await Promise.resolve();
      expect(loadQueue()).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('Allow', () => {
    it('creates an anonymous ID and queues + sends subsequent events', async () => {
      configure();
      expect(shouldShowConsentPrompt()).toBe(true);

      allowAnalytics();
      expect(isAnalyticsAllowed()).toBe(true);
      expect(window.localStorage.getItem('prs:analytics:anonymous-id:v1')).not.toBeNull();

      trackPageViewed('/');
      trackExportSucceeded('svg');
      // track() fires an async flush internally; let microtasks settle.
      await Promise.resolve();
      await Promise.resolve();

      expect(fetchMock).toHaveBeenCalled();
      expect(loadQueue()).toEqual([]); // sent and dropped on the mocked 2xx
    });
  });

  describe('opt-out', () => {
    it('clears the anonymous ID and queue, and sends nothing afterward', async () => {
      configure();
      allowAnalytics();
      trackPageViewed('/');
      await Promise.resolve();
      await Promise.resolve();
      fetchMock.mockClear();

      declineAnalytics();
      expect(isAnalyticsAllowed()).toBe(false);
      expect(window.localStorage.getItem('prs:analytics:anonymous-id:v1')).toBeNull();
      expect(loadQueue()).toEqual([]);

      trackPageViewed('/workspace');
      trackProjectCreated('import');
      await Promise.resolve();

      expect(fetchMock).not.toHaveBeenCalled();
      expect(loadQueue()).toEqual([]);
    });
  });
});
