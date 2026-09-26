import { afterEach, describe, expect, it } from 'vitest';
import { MAX_QUEUE_SIZE } from '@/analytics/contract';
import { clearQueue, enqueueEvent, loadQueue, pruneExpired, saveQueue } from '@/analytics/queue';
import type { FullEvent } from '@/analytics/contract';

function makeEvent(overrides: Partial<FullEvent> = {}): FullEvent {
  return {
    eventId: crypto.randomUUID(),
    occurredAt: new Date().toISOString(),
    anonymousId: 'anon-0000',
    name: 'page_viewed',
    properties: { path: '/' },
    ...overrides,
  };
}

describe('queue', () => {
  afterEach(() => {
    clearQueue();
  });

  it('starts empty', () => {
    expect(loadQueue()).toEqual([]);
  });

  it('enqueues and loads events in order', () => {
    const a = makeEvent({ eventId: 'a' });
    const b = makeEvent({ eventId: 'b' });
    enqueueEvent(a);
    enqueueEvent(b);
    expect(loadQueue().map((e) => e.eventId)).toEqual(['a', 'b']);
  });

  it('caps the queue at MAX_QUEUE_SIZE, dropping the oldest first', () => {
    for (let i = 0; i < MAX_QUEUE_SIZE + 10; i++) {
      enqueueEvent(makeEvent({ eventId: `evt-${i}` }));
    }
    const queue = loadQueue();
    expect(queue).toHaveLength(MAX_QUEUE_SIZE);
    expect(queue[0]?.eventId).toBe('evt-10'); // the first 10 were dropped
    expect(queue[queue.length - 1]?.eventId).toBe(`evt-${MAX_QUEUE_SIZE + 9}`);
  });

  it('drops events older than 7 days on prune', () => {
    const now = Date.now();
    const fresh = makeEvent({ eventId: 'fresh', occurredAt: new Date(now - 1000).toISOString() });
    const eightDaysOld = makeEvent({
      eventId: 'stale',
      occurredAt: new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const justUnderSevenDays = makeEvent({
      eventId: 'borderline',
      occurredAt: new Date(now - (7 * 24 * 60 * 60 * 1000 - 1000)).toISOString(),
    });
    saveQueue([fresh, eightDaysOld, justUnderSevenDays]);
    const pruned = pruneExpired(loadQueue(), now);
    expect(pruned.map((e) => e.eventId).sort()).toEqual(['borderline', 'fresh']);
  });

  it('drops events with an unparseable occurredAt rather than keeping them forever', () => {
    saveQueue([makeEvent({ eventId: 'bad', occurredAt: 'not-a-date' })]);
    expect(pruneExpired(loadQueue())).toEqual([]);
  });

  it('clearQueue empties everything', () => {
    enqueueEvent(makeEvent());
    clearQueue();
    expect(loadQueue()).toEqual([]);
  });

  it('recovers from corrupt storage instead of throwing', () => {
    window.localStorage.setItem('prs:analytics:queue:v1', '{not json');
    expect(loadQueue()).toEqual([]);
  });
});
