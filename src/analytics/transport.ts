/**
 * Batch transport. Sends up to `MAX_EVENTS_PER_BATCH` queued events at a
 * time via `fetch(..., { keepalive: true, headers: { 'content-type':
 * 'text/plain' } })` -- `text/plain` deliberately avoids a CORS preflight
 * (see docs/DECISIONS.md); the ingest server accepts it and parses the body
 * as JSON regardless of the declared content type. The token travels in the
 * body, not a header, for the same preflight-avoidance reason.
 *
 * Response handling:
 * - 2xx: drop the sent events from the queue.
 * - 4xx other than 429: drop the sent events (server will never accept
 *   them) and don't retry.
 * - 429 / 5xx / network error: keep the events queued and back off before
 *   trying again.
 */
import { getAnalyticsConfig } from '@/analytics/config';
import { MAX_BODY_BYTES, MAX_EVENTS_PER_BATCH, type FullEvent } from '@/analytics/contract';
import { loadQueue, pruneExpired, saveQueue } from '@/analytics/queue';

const INITIAL_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 5 * 60_000;

let backoffUntil = 0;
let backoffMs = INITIAL_BACKOFF_MS;

export function resetBackoffForTests(): void {
  backoffUntil = 0;
  backoffMs = INITIAL_BACKOFF_MS;
}

function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

type FetchLike = (input: string, init: RequestInit) => Promise<{ ok: boolean; status: number }>;

/** Trims a batch, from the end, until its serialized body fits the
 * server's body-size limit -- events are always small (no file/image/mesh
 * data ever reaches this layer), so this is a defensive floor, not
 * something expected to trigger in practice. */
function fitBatchToByteBudget(
  batch: FullEvent[],
  token: string,
): { batch: FullEvent[]; body: string } {
  let candidate = batch;
  for (;;) {
    const body = JSON.stringify({ token, events: candidate });
    if (candidate.length <= 1 || new TextEncoder().encode(body).length <= MAX_BODY_BYTES) {
      return { batch: candidate, body };
    }
    candidate = candidate.slice(0, Math.ceil(candidate.length / 2));
  }
}

/** Attempts to drain the local queue, one batch (<=20 events) per request,
 * stopping as soon as anything is left queued (a rejected/failed batch, or
 * the queue was already empty). Safe to call opportunistically and often --
 * it is a fast no-op when unconfigured, offline, backing off, or empty. */
export async function flushQueue(
  storage: Storage = window.localStorage,
  fetchImpl: FetchLike = fetch,
  now: number = Date.now(),
): Promise<void> {
  const config = getAnalyticsConfig();
  if (!config) return;
  if (!isOnline()) return;
  if (now < backoffUntil) return;

  let queue = pruneExpired(loadQueue(storage), now);
  saveQueue(queue, storage);

  while (queue.length > 0) {
    const candidateBatch = queue.slice(0, MAX_EVENTS_PER_BATCH);
    const { batch, body } = fitBatchToByteBudget(candidateBatch, config.token);
    const rest = queue.slice(batch.length);

    let response: { ok: boolean; status: number };
    try {
      response = await fetchImpl(`${config.ingestUrl}/v1/ingest/events`, {
        method: 'POST',
        keepalive: true,
        headers: { 'content-type': 'text/plain' },
        body,
      });
    } catch {
      // Network error -- keep the whole remaining queue (batch included)
      // and back off.
      saveQueue(queue, storage);
      backoffUntil = now + backoffMs;
      backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
      return;
    }

    if (response.ok) {
      backoffMs = INITIAL_BACKOFF_MS;
      queue = rest;
      saveQueue(queue, storage);
      continue;
    }

    if (response.status === 429 || response.status >= 500) {
      saveQueue(queue, storage);
      backoffUntil = now + backoffMs;
      backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
      return;
    }

    // Other 4xx: the server will never accept this batch -- drop it and
    // don't retry, but keep draining whatever's left behind it.
    queue = rest;
    saveQueue(queue, storage);
  }
}
