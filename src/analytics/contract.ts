/**
 * Local mirror of the fields/limits of VenturePilot's ingest contract
 * (`packages/contracts/src/ingest.ts` in the VenturePilot repo) that this
 * app actually needs. Deliberately NOT imported from that repo -- PRS and
 * VenturePilot are separate repositories/deployables, and this keeps PRS
 * buildable and testable with zero cross-repo dependency. If the contract
 * ever changes, this file is the one place to update on this side.
 *
 * Only the subset of the real contract PRS emits is represented here (see
 * docs/ANALYTICS.md for the full event dictionary): a project token
 * pattern, common per-event fields, and five event shapes. The real
 * contract additionally allows `checkout_started`/`feedback_submitted`
 * events and a wider set of values for some fields (e.g. `origin: 'blank'`,
 * `export_failed.reason` beyond `'unknown'`) -- PRS never sends those, so
 * they're intentionally not modeled here.
 */

/** Matches the real contract's `PUBLIC_PROJECT_TOKEN_PATTERN`. */
export const PUBLIC_PROJECT_TOKEN_PATTERN = /^vpp_[A-Za-z0-9_-]{20,64}$/;

/** Matches the real contract's `PseudonymousId` shape (anonymousId/sessionId). */
export const PSEUDONYMOUS_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

/** Matches the real contract's `experimentRef` shape, e.g. `EXP-002`. */
export const EXPERIMENT_REF_PATTERN = /^EXP-\d{3,}$/;

/** Matches the real contract's `Slug` shape (used for `variant`). */
export const VARIANT_PATTERN = /^[a-z0-9][a-z0-9_-]{0,31}$/;

/** Matches the real contract's `appVersion` shape. */
export const APP_VERSION_PATTERN = /^[A-Za-z0-9._+-]{1,32}$/;

export const MAX_EVENTS_PER_BATCH = 20;
export const MAX_BODY_BYTES = 16 * 1024;
/** Events older than this are rejected server-side -- pruned client-side
 * too so the queue never accumulates events that can never be delivered. */
export const MAX_EVENT_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** Local queue cap, independent of the server's per-batch limit -- keeps
 * localStorage usage bounded even if the app is used offline for a long
 * time before ever coming back online. */
export const MAX_QUEUE_SIZE = 200;

export type AcquisitionSource = 'direct' | 'search' | 'social' | 'ad' | 'referral' | 'other';

export type PageViewedPath = '/' | '/workspace';
export type ProjectCreatedOrigin = 'sample' | 'import';
export type ExportFormat = 'svg' | 'png' | 'pdf';
export type ExportFailedReason = 'unknown';

/** The event shapes (name + properties) PRS is allowed to build. Common
 * fields (eventId, occurredAt, anonymousId, ...) are added separately by
 * `buildFullEvent` -- see `eventBuilder.ts`. */
export type EventPayload =
  | { name: 'page_viewed'; properties: { path: PageViewedPath } }
  | { name: 'project_created'; properties: { origin: ProjectCreatedOrigin } }
  | { name: 'pattern_completed'; properties: { durationSeconds?: number } }
  | { name: 'export_succeeded'; properties: { format: ExportFormat } }
  | { name: 'export_failed'; properties: { reason: ExportFailedReason } };

export type ProductEventName = EventPayload['name'];

/** A fully-formed event, ready to queue/send -- matches the shape the real
 * contract's `ProductEvent` schema will accept (a strict subset of it). */
export interface FullEvent {
  eventId: string;
  occurredAt: string;
  anonymousId: string;
  sessionId?: string;
  experimentRef?: string;
  variant?: string;
  appVersion?: string;
  source?: AcquisitionSource;
  name: ProductEventName;
  properties: Record<string, unknown>;
}
