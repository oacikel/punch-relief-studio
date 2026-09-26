import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAnalyticsConfig,
  isAnalyticsConfigured,
  resetAnalyticsConfigCacheForTests,
} from '@/analytics/config';

describe('analytics config', () => {
  beforeEach(() => {
    resetAnalyticsConfigCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetAnalyticsConfigCacheForTests();
  });

  it('is unconfigured when neither env var is set (the public GitHub Pages build)', () => {
    expect(isAnalyticsConfigured()).toBe(false);
    expect(getAnalyticsConfig()).toBeNull();
  });

  it('is unconfigured when only the ingest URL is set', () => {
    vi.stubEnv('VITE_VP_INGEST_URL', 'https://ingest.example.com');
    expect(isAnalyticsConfigured()).toBe(false);
  });

  it('is unconfigured when only the token is set', () => {
    vi.stubEnv('VITE_VP_PROJECT_TOKEN', 'vpp_abcdefghijklmnopqrstuvwx');
    expect(isAnalyticsConfigured()).toBe(false);
  });

  it('is unconfigured when the token does not match the public-token pattern', () => {
    vi.stubEnv('VITE_VP_INGEST_URL', 'https://ingest.example.com');
    vi.stubEnv('VITE_VP_PROJECT_TOKEN', 'not-a-valid-token');
    expect(isAnalyticsConfigured()).toBe(false);
  });

  it('is configured when both env vars are set validly, and strips a trailing slash', () => {
    vi.stubEnv('VITE_VP_INGEST_URL', 'https://ingest.example.com/');
    vi.stubEnv('VITE_VP_PROJECT_TOKEN', 'vpp_abcdefghijklmnopqrstuvwx');
    expect(isAnalyticsConfigured()).toBe(true);
    expect(getAnalyticsConfig()).toEqual({
      ingestUrl: 'https://ingest.example.com',
      token: 'vpp_abcdefghijklmnopqrstuvwx',
      appVersion: undefined,
    });
  });

  it('includes a validly-shaped app version and omits an invalid one', () => {
    vi.stubEnv('VITE_VP_INGEST_URL', 'https://ingest.example.com');
    vi.stubEnv('VITE_VP_PROJECT_TOKEN', 'vpp_abcdefghijklmnopqrstuvwx');
    vi.stubEnv('VITE_APP_VERSION', '1.2.3');
    expect(getAnalyticsConfig()?.appVersion).toBe('1.2.3');

    resetAnalyticsConfigCacheForTests();
    vi.stubEnv('VITE_APP_VERSION', 'not valid!!');
    expect(getAnalyticsConfig()?.appVersion).toBeUndefined();
  });

  it('caches the first read (env is build-time constant) until reset', () => {
    expect(getAnalyticsConfig()).toBeNull();
    vi.stubEnv('VITE_VP_INGEST_URL', 'https://ingest.example.com');
    vi.stubEnv('VITE_VP_PROJECT_TOKEN', 'vpp_abcdefghijklmnopqrstuvwx');
    // Still null: cached from the first read above.
    expect(getAnalyticsConfig()).toBeNull();
    resetAnalyticsConfigCacheForTests();
    expect(getAnalyticsConfig()).not.toBeNull();
  });
});
