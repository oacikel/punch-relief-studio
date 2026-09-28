/**
 * Public analytics API -- the only module App.tsx/ExportPanel.tsx/
 * PrivacyControl.tsx import from. Every exported `track*` function is a
 * no-op unless analytics is configured (`config.ts`) AND consent has been
 * granted (`consent.ts`); see docs/ANALYTICS.md for the event dictionary
 * and docs/DECISIONS.md for the design rationale.
 */
import {
  clearConsent as clearConsentStorage,
  getConsentState,
  hasGlobalPrivacyControl,
  setConsentDenied,
  setConsentGranted,
} from '@/analytics/consent';
import { getAnalyticsConfig, isAnalyticsConfigured } from '@/analytics/config';
import {
  buildFullEvent,
  exportFailedEvent,
  exportSucceededEvent,
  pageViewedEvent,
  patternCompletedEvent,
  projectCreatedEvent,
} from '@/analytics/eventBuilder';
import {
  clearAnonymousId,
  createAnonymousId,
  generateRandomId,
  getAnonymousId,
  getOrCreateSessionId,
} from '@/analytics/ids';
import { captureLandingContext, getCachedExperiment, getCachedSource } from '@/analytics/source';
import { assignPaletteOrderExperiment, getPaletteOrderVariant } from '@/analytics/paletteOrder';
import { enqueueEvent, clearQueue } from '@/analytics/queue';
import { flushQueue } from '@/analytics/transport';
import { startFlushScheduler } from '@/analytics/scheduler';
import type {
  EventPayload,
  ExportFailedReason,
  ExportFormat,
  PageViewedPath,
  ProjectCreatedOrigin,
} from '@/analytics/contract';

export { isAnalyticsConfigured };
export { hasGlobalPrivacyControl } from '@/analytics/consent';

/** Call once, near app start. A no-op when unconfigured. */
export function initAnalytics(): void {
  if (!isAnalyticsConfigured()) return;
  if (!hasGlobalPrivacyControl()) {
    captureLandingContext();
    // EXP-002 ("move yarn palette selection earlier"): self-assigns 50/50
    // into earlier/control, in the same sessionStorage slot the ?exp=
    // landing parser uses, so every product event this session sends
    // carries experimentRef EXP-002 + variant with no change at any
    // track* call site. A no-op when a link already put this session in
    // another experiment -- see paletteOrder.ts.
    assignPaletteOrderExperiment();
  }
  startFlushScheduler();
  if (getConsentState() === 'granted') void flushQueue();
}

export function shouldShowConsentPrompt(): boolean {
  return isAnalyticsConfigured() && !hasGlobalPrivacyControl() && getConsentState() === 'unknown';
}

export function isAnalyticsAllowed(): boolean {
  return isAnalyticsConfigured() && getConsentState() === 'granted';
}

/**
 * EXP-002: whether this session should see the Yarn step before the Shape
 * step in the Workspace rail. Reads the variant assigned in
 * `initAnalytics()`; an unassigned session (analytics unconfigured, GPC, or
 * a link-provided experiment) gets `false` -- today's order -- rather than
 * the treatment, since reordering numbered steps has effects well beyond
 * what's being measured (see `paletteOrder.ts`).
 */
export function shouldMoveYarnColorsEarlier(): boolean {
  return getPaletteOrderVariant() === 'earlier';
}

/** User clicked "Allow". Only now does an anonymous ID get created. */
export function allowAnalytics(): void {
  if (!isAnalyticsConfigured()) return;
  setConsentGranted();
  createAnonymousId();
  void flushQueue();
}

/** User clicked "No thanks", or later opted out via the Privacy control.
 * Deletes the anonymous ID and the entire queue -- nothing already queued
 * is sent after this. */
export function declineAnalytics(): void {
  setConsentDenied();
  clearAnonymousId();
  clearQueue();
}

function track(payload: EventPayload): void {
  const config = getAnalyticsConfig();
  if (!config) return;
  if (getConsentState() !== 'granted') return;
  const anonymousId = getAnonymousId();
  if (!anonymousId) return; // consent granted but ID missing is unexpected; fail closed
  const experiment = getCachedExperiment();
  const source = getCachedSource();
  const event = buildFullEvent(
    payload,
    {
      anonymousId,
      sessionId: getOrCreateSessionId(),
      ...(experiment.experimentRef !== undefined
        ? { experimentRef: experiment.experimentRef }
        : {}),
      ...(experiment.variant !== undefined ? { variant: experiment.variant } : {}),
      ...(config.appVersion !== undefined ? { appVersion: config.appVersion } : {}),
      ...(source !== undefined ? { source } : {}),
    },
    { eventId: generateRandomId(), occurredAt: new Date().toISOString() },
  );
  enqueueEvent(event);
  void flushQueue();
}

export function trackPageViewed(path: PageViewedPath): void {
  track(pageViewedEvent({ path }));
}

export function trackProjectCreated(origin: ProjectCreatedOrigin): void {
  track(projectCreatedEvent({ origin }));
}

export function trackPatternCompleted(durationSeconds?: number): void {
  track(patternCompletedEvent(durationSeconds === undefined ? {} : { durationSeconds }));
}

export function trackExportSucceeded(format: ExportFormat): void {
  track(exportSucceededEvent({ format }));
}

export function trackExportFailed(reason: ExportFailedReason): void {
  track(exportFailedEvent({ reason }));
}

/** Exposed for `PrivacyControl.tsx` teardown/testing only. */
export function resetAnalyticsConsentForTests(): void {
  clearConsentStorage();
}
