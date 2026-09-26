/**
 * Whitelisting event builders. Every event PRS can ever send is constructed
 * here, by hand, from typed primitive arguments -- never by spreading an
 * arbitrary object. This is deliberate: it's the one place that guarantees
 * a caller can never smuggle an extra field (a filename, image data, mesh
 * data, settings, project name, ...) into an outgoing event, even if such a
 * field is present on whatever object a caller happens to pass in. See
 * `__tests__/eventBuilder.test.ts` for tests proving exactly that.
 */
import type {
  EventPayload,
  ExportFailedReason,
  ExportFormat,
  FullEvent,
  PageViewedPath,
  ProjectCreatedOrigin,
  AcquisitionSource,
} from '@/analytics/contract';

const MAX_DURATION_SECONDS = 7 * 24 * 3600;

/** Accepts loosely-typed input (deliberately widened past the strict
 * `PageViewedPath`/etc. types below) so a caller passing extra properties
 * -- or a value from an untyped source -- still only ever contributes the
 * one field each builder actually reads. Anything else on `input` is
 * ignored, not merely untyped. */
export function pageViewedEvent(
  input: { path: PageViewedPath } & Record<string, unknown>,
): EventPayload {
  const { path } = input;
  if (path !== '/' && path !== '/workspace') {
    throw new Error(`analytics: invalid page_viewed path ${JSON.stringify(path)}`);
  }
  return { name: 'page_viewed', properties: { path } };
}

export function projectCreatedEvent(
  input: { origin: ProjectCreatedOrigin } & Record<string, unknown>,
): EventPayload {
  const { origin } = input;
  if (origin !== 'sample' && origin !== 'import') {
    throw new Error(`analytics: invalid project_created origin ${JSON.stringify(origin)}`);
  }
  return { name: 'project_created', properties: { origin } };
}

export function patternCompletedEvent(
  input: { durationSeconds?: number } & Record<string, unknown>,
): EventPayload {
  const raw = input.durationSeconds;
  const durationSeconds =
    typeof raw === 'number' && Number.isFinite(raw) && raw >= 0
      ? Math.min(Math.round(raw), MAX_DURATION_SECONDS)
      : undefined;
  return durationSeconds === undefined
    ? { name: 'pattern_completed', properties: {} }
    : { name: 'pattern_completed', properties: { durationSeconds } };
}

export function exportSucceededEvent(
  input: { format: ExportFormat } & Record<string, unknown>,
): EventPayload {
  const { format } = input;
  if (format !== 'svg' && format !== 'png' && format !== 'pdf') {
    throw new Error(`analytics: invalid export_succeeded format ${JSON.stringify(format)}`);
  }
  return { name: 'export_succeeded', properties: { format } };
}

export function exportFailedEvent(
  input: { reason: ExportFailedReason } & Record<string, unknown>,
): EventPayload {
  const { reason } = input;
  if (reason !== 'unknown') {
    throw new Error(`analytics: invalid export_failed reason ${JSON.stringify(reason)}`);
  }
  return { name: 'export_failed', properties: { reason } };
}

export interface CommonEventFields {
  anonymousId: string;
  sessionId?: string;
  experimentRef?: string;
  variant?: string;
  appVersion?: string;
  source?: AcquisitionSource;
}

/** Combines a whitelisted `EventPayload` with the common per-event fields
 * into the final wire shape, again by explicit construction (never a
 * spread of caller-controlled data) so this stays the single choke point
 * unknown fields cannot pass through. `exactOptionalPropertyTypes` is on
 * project-wide, so optional keys are included only when present rather
 * than ever being assigned `undefined`. */
export function buildFullEvent(
  payload: EventPayload,
  common: CommonEventFields,
  ids: { eventId: string; occurredAt: string },
): FullEvent {
  const event: FullEvent = {
    eventId: ids.eventId,
    occurredAt: ids.occurredAt,
    anonymousId: common.anonymousId,
    name: payload.name,
    properties: payload.properties,
  };
  if (common.sessionId !== undefined) event.sessionId = common.sessionId;
  if (common.experimentRef !== undefined) event.experimentRef = common.experimentRef;
  if (common.variant !== undefined) event.variant = common.variant;
  if (common.appVersion !== undefined) event.appVersion = common.appVersion;
  if (common.source !== undefined) event.source = common.source;
  return event;
}
