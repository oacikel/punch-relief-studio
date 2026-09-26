import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetAnalyticsConfigCacheForTests } from '@/analytics/config';
import { MAX_EVENTS_PER_BATCH } from '@/analytics/contract';
import type { FullEvent } from '@/analytics/contract';
import { clearQueue, enqueueEvent, loadQueue } from '@/analytics/queue';
import { flushQueue, resetBackoffForTests } from '@/analytics/transport';

function makeEvent(id: string): FullEvent {
  return {
    eventId: id,
    occurredAt: new Date().toISOString(),
    anonymousId: 'anon-0000',
    name: 'page_viewed',
    properties: { path: '/' },
  };
}

function configure(): void {
  vi.stubEnv('VITE_VP_INGEST_URL', 'https://ingest.example.com');
  vi.stubEnv('VITE_VP_PROJECT_TOKEN', 'vpp_abcdefghijklmnopqrstuvwx');
  resetAnalyticsConfigCacheForTests();
}

describe('transport / flushQueue', () => {
  let onlineSpy: ReturnType<typeof vi.spyOn> | undefined;

  beforeEach(() => {
    resetBackoffForTests();
  });

  afterEach(() => {
    clearQueue();
    vi.unstubAllEnvs();
    resetAnalyticsConfigCacheForTests();
    resetBackoffForTests();
    onlineSpy?.mockRestore();
    onlineSpy = undefined;
  });

  function setOnline(value: boolean): void {
    onlineSpy = vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(value);
  }

  it('is a no-op (no fetch) when analytics is not configured', async () => {
    enqueueEvent(makeEvent('a'));
    const fetchImpl = vi.fn();
    await flushQueue(window.localStorage, fetchImpl);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(loadQueue()).toHaveLength(1);
  });

  it('is a no-op when offline', async () => {
    configure();
    setOnline(false);
    enqueueEvent(makeEvent('a'));
    const fetchImpl = vi.fn();
    await flushQueue(window.localStorage, fetchImpl);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(loadQueue()).toHaveLength(1);
  });

  it('is a no-op on an empty queue', async () => {
    configure();
    const fetchImpl = vi.fn();
    await flushQueue(window.localStorage, fetchImpl);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('sends a text/plain, keepalive POST to {base}/v1/ingest/events with the token in the body', async () => {
    configure();
    enqueueEvent(makeEvent('a'));
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    await flushQueue(window.localStorage, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://ingest.example.com/v1/ingest/events');
    expect(init.method).toBe('POST');
    expect(init.keepalive).toBe(true);
    expect((init.headers as Record<string, string>)['content-type']).toBe('text/plain');
    const body: { token: string; events: FullEvent[] } = JSON.parse(init.body as string);
    expect(body.token).toBe('vpp_abcdefghijklmnopqrstuvwx');
    expect(body.events).toHaveLength(1);
  });

  it('drops sent events on a 2xx response', async () => {
    configure();
    enqueueEvent(makeEvent('a'));
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    await flushQueue(window.localStorage, fetchImpl);
    expect(loadQueue()).toEqual([]);
  });

  it('drops the batch and does not retry on a non-429 4xx', async () => {
    configure();
    enqueueEvent(makeEvent('a'));
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 400 });
    await flushQueue(window.localStorage, fetchImpl);
    expect(loadQueue()).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('keeps the batch and backs off on a 429', async () => {
    configure();
    enqueueEvent(makeEvent('a'));
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 429 });
    await flushQueue(window.localStorage, fetchImpl, 1_000);
    expect(loadQueue()).toHaveLength(1);
    // A second attempt immediately after must not call fetch again -- backoff.
    await flushQueue(window.localStorage, fetchImpl, 1_500);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('keeps the batch and backs off on a 5xx', async () => {
    configure();
    enqueueEvent(makeEvent('a'));
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    await flushQueue(window.localStorage, fetchImpl, 1_000);
    expect(loadQueue()).toHaveLength(1);
  });

  it('keeps the batch and backs off on a network error', async () => {
    configure();
    enqueueEvent(makeEvent('a'));
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await flushQueue(window.localStorage, fetchImpl, 1_000);
    expect(loadQueue()).toHaveLength(1);
    await flushQueue(window.localStorage, fetchImpl, 1_500);
    expect(fetchImpl).toHaveBeenCalledTimes(1); // still backing off
  });

  it('retries again once the backoff window has passed', async () => {
    configure();
    enqueueEvent(makeEvent('a'));
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    await flushQueue(window.localStorage, fetchImpl, 1_000);
    expect(loadQueue()).toHaveLength(1);
    await flushQueue(window.localStorage, fetchImpl, 1_000 + 6 * 60_000); // well past initial backoff
    expect(loadQueue()).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('drains multiple batches of up to 20 events each when healthy', async () => {
    configure();
    for (let i = 0; i < MAX_EVENTS_PER_BATCH + 5; i++) enqueueEvent(makeEvent(`evt-${i}`));
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    await flushQueue(window.localStorage, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(loadQueue()).toEqual([]);
    const firstBatchSize = (
      JSON.parse((fetchImpl.mock.calls[0]![1] as RequestInit).body as string) as {
        events: unknown[];
      }
    ).events.length;
    expect(firstBatchSize).toBe(MAX_EVENTS_PER_BATCH);
  });
});
