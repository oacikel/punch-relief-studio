/**
 * localStorage-backed offline queue. Capped at `MAX_QUEUE_SIZE`; events
 * older (by `occurredAt`) than `MAX_EVENT_AGE_MS` are dropped on every
 * prune since the server rejects them anyway (see `contract.ts`).
 */
import { MAX_EVENT_AGE_MS, MAX_QUEUE_SIZE, type FullEvent } from '@/analytics/contract';

const QUEUE_KEY = 'prs:analytics:queue:v1';

export function loadQueue(storage: Storage = window.localStorage): FullEvent[] {
  try {
    const raw = storage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FullEvent[]) : [];
  } catch {
    // Corrupt queue storage should never crash the app -- drop it.
    return [];
  }
}

export function saveQueue(events: FullEvent[], storage: Storage = window.localStorage): void {
  try {
    storage.setItem(QUEUE_KEY, JSON.stringify(events));
  } catch {
    // Storage full/unavailable -- analytics is best-effort, never a hard
    // failure for the rest of the app. Silently drop rather than throw.
  }
}

export function pruneExpired(events: FullEvent[], now: number = Date.now()): FullEvent[] {
  return events.filter((event) => {
    const occurredAtMs = Date.parse(event.occurredAt);
    if (Number.isNaN(occurredAtMs)) return false;
    return now - occurredAtMs <= MAX_EVENT_AGE_MS;
  });
}

/** Appends one event, pruning expired entries first and trimming from the
 * front (oldest-first) if over `MAX_QUEUE_SIZE`. */
export function enqueueEvent(event: FullEvent, storage: Storage = window.localStorage): void {
  let queue = pruneExpired(loadQueue(storage));
  queue.push(event);
  if (queue.length > MAX_QUEUE_SIZE) {
    queue = queue.slice(queue.length - MAX_QUEUE_SIZE);
  }
  saveQueue(queue, storage);
}

export function clearQueue(storage: Storage = window.localStorage): void {
  storage.removeItem(QUEUE_KEY);
}
