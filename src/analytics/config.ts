/**
 * Build-time analytics configuration. Everything under `src/analytics/**`
 * (and the `PrivacyControl`/consent-prompt UI) is inert unless BOTH
 * `VITE_VP_INGEST_URL` and `VITE_VP_PROJECT_TOKEN` are set at build time --
 * neither is set for the public GitHub Pages build, so this whole feature
 * is a no-op there: no consent prompt, no Privacy control, no localStorage/
 * sessionStorage keys, no queue, no network calls. See docs/DECISIONS.md
 * and docs/ANALYTICS.md.
 */
import { APP_VERSION_PATTERN, PUBLIC_PROJECT_TOKEN_PATTERN } from '@/analytics/contract';

export interface AnalyticsConfig {
  /** Base URL, no trailing slash -- events POST to `${ingestUrl}/v1/ingest/events`. */
  ingestUrl: string;
  token: string;
  /** Undefined when `VITE_APP_VERSION` isn't set or doesn't match the
   * contract's `appVersion` pattern -- omitted from events entirely rather
   * than sent as a value the server would reject the whole event for. */
  appVersion: string | undefined;
}

function readEnv(
  key: 'VITE_VP_INGEST_URL' | 'VITE_VP_PROJECT_TOKEN' | 'VITE_APP_VERSION',
): string | undefined {
  const value = import.meta.env[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

let cached: AnalyticsConfig | null | undefined;

/** Reads env once and caches the result -- `import.meta.env` values are
 * build-time constants, so this can never change within a running app. */
export function getAnalyticsConfig(): AnalyticsConfig | null {
  if (cached !== undefined) return cached;
  const ingestUrlRaw = readEnv('VITE_VP_INGEST_URL');
  const token = readEnv('VITE_VP_PROJECT_TOKEN');
  if (!ingestUrlRaw || !token || !PUBLIC_PROJECT_TOKEN_PATTERN.test(token)) {
    cached = null;
    return cached;
  }
  const rawAppVersion = readEnv('VITE_APP_VERSION');
  const appVersion =
    rawAppVersion && APP_VERSION_PATTERN.test(rawAppVersion) ? rawAppVersion : undefined;
  cached = { ingestUrl: ingestUrlRaw.replace(/\/+$/, ''), token, appVersion };
  return cached;
}

export function isAnalyticsConfigured(): boolean {
  return getAnalyticsConfig() !== null;
}

/** Test-only escape hatch: `getAnalyticsConfig` caches on first read since
 * env is normally build-time-constant, but unit tests stub
 * `import.meta.env` per-test and need each test to re-read it. */
export function resetAnalyticsConfigCacheForTests(): void {
  cached = undefined;
}
