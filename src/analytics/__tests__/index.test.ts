import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetAnalyticsConfigCacheForTests } from '@/analytics/config';
import { clearConsent } from '@/analytics/consent';
import { clearQueue, loadQueue } from '@/analytics/queue';
import { resetBackoffForTests } from '@/analytics/transport';
import { resetFlushSchedulerForTests } from '@/analytics/scheduler';
import { PREVIEW_EXPECTATIONS_VARIANTS } from '@/analytics/previewExpectations';
import {
  allowAnalytics,
  declineAnalytics,
  initAnalytics,
  isAnalyticsAllowed,
  isAnalyticsConfigured,
  shouldShowConsentPrompt,
  shouldShowPreviewExpectations,
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

    it('still shows EXP-003s notice, since there is no measurement to hold a control group back for', () => {
      initAnalytics();
      expect(shouldShowPreviewExpectations()).toBe(true);
      expect(window.sessionStorage.length).toBe(0);
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

  describe('EXP-003 measurement', () => {
    it('labels every product event with experimentRef EXP-003 and the assigned variant', async () => {
      configure();
      initAnalytics();
      allowAnalytics();
      trackPageViewed('/');
      trackProjectCreated('sample');
      trackExportSucceeded('svg');
      await Promise.resolve();
      await Promise.resolve();

      const events = fetchMock.mock.calls.map((call) => {
        const body = JSON.parse((call[1] as { body: string }).body) as {
          events: Array<{ name: string; experimentRef?: string; variant?: string }>;
        };
        return body.events;
      });
      const flat = events.flat();
      expect(flat.map((e) => e.name)).toEqual(
        expect.arrayContaining(['page_viewed', 'project_created', 'export_succeeded']),
      );
      for (const event of flat) {
        expect(event.experimentRef).toBe('EXP-003');
        expect(PREVIEW_EXPECTATIONS_VARIANTS).toContain(event.variant);
      }
      // The variant the UI branches on is the same one the events carry.
      const variantOnTheWire = flat[0]?.variant;
      expect(shouldShowPreviewExpectations()).toBe(variantOnTheWire === 'expectations');
    });

    it('leaves a link-recruited session labelled with its own experiment', async () => {
      window.history.pushState({}, '', '/?exp=EXP-002&v=b');
      configure();
      initAnalytics();
      allowAnalytics();
      trackPageViewed('/');
      await Promise.resolve();
      await Promise.resolve();

      const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as { body: string }).body) as {
        events: Array<{ experimentRef?: string; variant?: string }>;
      };
      expect(body.events[0]?.experimentRef).toBe('EXP-002');
      expect(body.events[0]?.variant).toBe('b');
      expect(shouldShowPreviewExpectations()).toBe(true);

      window.history.pushState({}, '', '/');
    });
  });
});
