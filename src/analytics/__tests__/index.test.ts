import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetAnalyticsConfigCacheForTests } from '@/analytics/config';
import { clearConsent } from '@/analytics/consent';
import { clearQueue, loadQueue } from '@/analytics/queue';
import { resetBackoffForTests } from '@/analytics/transport';
import { resetFlushSchedulerForTests } from '@/analytics/scheduler';
import { FIT_TO_SCREEN_PREVIEW_VARIANTS } from '@/analytics/fitToScreenPreview';
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

  describe('EXP-007 measurement', () => {
    it('labels every product event with experimentRef EXP-007 and the fit variant', async () => {
      configure();
      initAnalytics();
      allowAnalytics();

      trackPageViewed('/workspace');
      trackProjectCreated('import');
      trackExportSucceeded('svg');
      await Promise.resolve();
      await Promise.resolve();

      const events = fetchMock.mock.calls
        .map((call) => {
          const [, init] = call as [string, RequestInit];
          return JSON.parse(init.body as string) as {
            events: Array<{ name: string; experimentRef?: string; variant?: string }>;
          };
        })
        .flatMap((body) => body.events);

      expect(events.map((e) => e.name)).toEqual(
        expect.arrayContaining(['page_viewed', 'project_created', 'export_succeeded']),
      );
      for (const event of events) {
        expect(event.experimentRef).toBe('EXP-007');
        expect(FIT_TO_SCREEN_PREVIEW_VARIANTS).toContain(event.variant);
      }
    });

    it('leaves a link-recruited session labelled with its own experiment', async () => {
      window.history.pushState({}, '', '/?exp=EXP-002&v=b');
      configure();
      initAnalytics();
      allowAnalytics();

      trackPageViewed('/');
      await Promise.resolve();
      await Promise.resolve();

      const events = fetchMock.mock.calls
        .map((call) => {
          const [, init] = call as [string, RequestInit];
          return JSON.parse(init.body as string) as {
            events: Array<{ experimentRef?: string; variant?: string }>;
          };
        })
        .flatMap((body) => body.events);
      for (const event of events) {
        expect(event.experimentRef).toBe('EXP-002');
        expect(event.variant).toBe('b');
      }
      window.history.pushState({}, '', '/');
    });
  });
});
