/**
 * Coarse acquisition-source classification and experiment-exposure capture,
 * both done once per session (tab) on landing and cached in sessionStorage
 * -- never the query string or referrer URL itself, only the derived,
 * coarse category/experiment ref. Gated on analytics being configured and
 * GPC being absent (see `config.ts`/`consent.ts`); this is ambient,
 * non-identifying context, not itself sent anywhere unless/until an event
 * is later built and queued, which separately requires consent.
 */
import {
  EXPERIMENT_REF_PATTERN,
  VARIANT_PATTERN,
  type AcquisitionSource,
} from '@/analytics/contract';

const SOURCE_KEY = 'prs:analytics:source:v1';
const EXPERIMENT_KEY = 'prs:analytics:experiment:v1';

const SOCIAL_HOSTS = [
  'facebook.com',
  'instagram.com',
  'tiktok.com',
  'twitter.com',
  'x.com',
  't.co',
  'linkedin.com',
  'pinterest.com',
  'reddit.com',
  'youtube.com',
];

const SEARCH_HOSTS = ['google.', 'bing.com', 'duckduckgo.com', 'yahoo.com', 'baidu.com', 'yandex.'];

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function matchesAny(host: string, needles: string[]): boolean {
  return needles.some(
    (needle) => host === needle || host.endsWith(`.${needle}`) || host.includes(needle),
  );
}

/** Classifies once, from ambient signals only -- never persists the
 * referrer URL or query string themselves, only this coarse category. */
export function classifySource(referrer: string, searchParams: URLSearchParams): AcquisitionSource {
  const utmMedium = (searchParams.get('utm_medium') ?? '').toLowerCase();
  const utmSource = (searchParams.get('utm_source') ?? '').toLowerCase();
  if (utmMedium === 'cpc' || utmMedium === 'ppc' || utmMedium === 'paid' || utmMedium === 'ad') {
    return 'ad';
  }
  if (utmMedium === 'social' || (utmSource && matchesAny(utmSource, SOCIAL_HOSTS))) {
    return 'social';
  }
  if (utmMedium === 'search' || (utmSource && matchesAny(utmSource, SEARCH_HOSTS))) {
    return 'search';
  }
  if (!referrer) return 'direct';
  const referrerHost = hostOf(referrer);
  if (!referrerHost) return 'other';
  if (typeof window !== 'undefined' && referrerHost === window.location.hostname) return 'direct';
  if (matchesAny(referrerHost, SOCIAL_HOSTS)) return 'social';
  if (matchesAny(referrerHost, SEARCH_HOSTS)) return 'search';
  return 'referral';
}

/** Reads the cached classification, computing and caching it on first call
 * this session. Returns `undefined` if analytics storage hasn't been
 * initialized yet (see `captureLandingContext`). */
export function getCachedSource(
  storage: Storage = window.sessionStorage,
): AcquisitionSource | undefined {
  const raw = storage.getItem(SOURCE_KEY);
  return raw === 'direct' ||
    raw === 'search' ||
    raw === 'social' ||
    raw === 'ad' ||
    raw === 'referral' ||
    raw === 'other'
    ? raw
    : undefined;
}

export interface ExperimentContext {
  experimentRef?: string;
  variant?: string;
}

export function getCachedExperiment(storage: Storage = window.sessionStorage): ExperimentContext {
  const raw = storage.getItem(EXPERIMENT_KEY);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const experimentRef = (parsed as Record<string, unknown>)['experimentRef'];
    const variant = (parsed as Record<string, unknown>)['variant'];
    const result: ExperimentContext = {};
    if (typeof experimentRef === 'string') result.experimentRef = experimentRef;
    if (typeof variant === 'string') result.variant = variant;
    return result;
  } catch {
    return {};
  }
}

/** Writes the session's experiment context, overwriting whatever was there.
 * Self-assignment callers check first that the session isn't already in an
 * experiment. This function deliberately owns nothing but the storage write,
 * so the sessionStorage key stays defined in exactly one module. */
export function writeExperimentContext(
  context: ExperimentContext,
  storage: Storage = window.sessionStorage,
): void {
  storage.setItem(EXPERIMENT_KEY, JSON.stringify(context));
}

/** Classifies source and captures `?exp=EXP-002&v=b` once per session, from
 * the current landing URL/referrer, caching both in sessionStorage. A
 * no-op on repeat calls within the same session (sessionStorage already
 * populated) -- landing context is captured once, not re-derived from
 * whatever page happens to be current later. */
export function captureLandingContext(storage: Storage = window.sessionStorage): void {
  if (storage.getItem(SOURCE_KEY) === null) {
    const source = classifySource(document.referrer, new URLSearchParams(window.location.search));
    storage.setItem(SOURCE_KEY, source);
  }
  if (storage.getItem(EXPERIMENT_KEY) === null) {
    const params = new URLSearchParams(window.location.search);
    const expRaw = params.get('exp');
    const variantRaw = params.get('v');
    const context: ExperimentContext = {};
    if (expRaw && EXPERIMENT_REF_PATTERN.test(expRaw)) context.experimentRef = expRaw;
    if (variantRaw && VARIANT_PATTERN.test(variantRaw)) context.variant = variantRaw;
    storage.setItem(EXPERIMENT_KEY, JSON.stringify(context));
  }
}
