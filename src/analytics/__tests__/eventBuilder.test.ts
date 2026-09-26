import { describe, expect, it } from 'vitest';
import {
  buildFullEvent,
  exportFailedEvent,
  exportSucceededEvent,
  pageViewedEvent,
  patternCompletedEvent,
  projectCreatedEvent,
} from '@/analytics/eventBuilder';

describe('eventBuilder whitelisting', () => {
  it('builds exactly the allowed page_viewed shape', () => {
    expect(pageViewedEvent({ path: '/' })).toEqual({
      name: 'page_viewed',
      properties: { path: '/' },
    });
    expect(pageViewedEvent({ path: '/workspace' })).toEqual({
      name: 'page_viewed',
      properties: { path: '/workspace' },
    });
  });

  it('rejects a path outside the two known app routes', () => {
    expect(() => pageViewedEvent({ path: '/other' as never })).toThrow();
  });

  it('drops a filename smuggled alongside a legitimate project_created origin', () => {
    const malicious = {
      origin: 'import' as const,
      filename: 'my-secret-heirloom.stl',
      originalFilePath: '/Users/me/Desktop/private.obj',
    };
    const event = projectCreatedEvent(malicious);
    expect(event).toEqual({ name: 'project_created', properties: { origin: 'import' } });
    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain('filename');
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('originalFilePath');
  });

  it('drops mesh/image data and settings smuggled alongside project_created', () => {
    const malicious = {
      origin: 'sample' as const,
      meshData: new Float32Array([1, 2, 3, 4, 5]),
      imageRgba: new Uint8ClampedArray([255, 0, 0, 255]),
      reliefSettings: { pileHeightLevels: 5, seed: 42 },
      projectName: "Grandma's quilt pattern",
    };
    const event = projectCreatedEvent(malicious);
    expect(event).toEqual({ name: 'project_created', properties: { origin: 'sample' } });
    expect(Object.keys(event.properties)).toEqual(['origin']);
  });

  it('rejects an origin outside sample/import even if smuggled fields look legitimate', () => {
    expect(() => projectCreatedEvent({ origin: 'blank' as never })).toThrow();
  });

  it('clamps and rounds pattern_completed durationSeconds, dropping other fields', () => {
    expect(patternCompletedEvent({ durationSeconds: 12.6, projectName: 'x' })).toEqual({
      name: 'pattern_completed',
      properties: { durationSeconds: 13 },
    });
    expect(patternCompletedEvent({})).toEqual({ name: 'pattern_completed', properties: {} });
    expect(patternCompletedEvent({ durationSeconds: -5 })).toEqual({
      name: 'pattern_completed',
      properties: {},
    });
    expect(patternCompletedEvent({ durationSeconds: Number.MAX_SAFE_INTEGER }).properties).toEqual({
      durationSeconds: 7 * 24 * 3600,
    });
  });

  it('builds only the allowed export_succeeded/export_failed shapes', () => {
    expect(exportSucceededEvent({ format: 'svg', filename: 'pattern.svg' })).toEqual({
      name: 'export_succeeded',
      properties: { format: 'svg' },
    });
    expect(exportSucceededEvent({ format: 'png' })).toEqual({
      name: 'export_succeeded',
      properties: { format: 'png' },
    });
    expect(exportSucceededEvent({ format: 'pdf' })).toEqual({
      name: 'export_succeeded',
      properties: { format: 'pdf' },
    });
    expect(() => exportSucceededEvent({ format: 'other' as never })).toThrow();
    expect(exportFailedEvent({ reason: 'unknown', errorMessage: 'stack trace here' })).toEqual({
      name: 'export_failed',
      properties: { reason: 'unknown' },
    });
    expect(() => exportFailedEvent({ reason: 'timeout' as never })).toThrow();
  });

  it('buildFullEvent only ever includes the known common fields, never arbitrary extras', () => {
    const full = buildFullEvent(
      { name: 'page_viewed', properties: { path: '/' } },
      {
        anonymousId: 'anon-1234',
        sessionId: 'sess-5678',
        // @ts-expect-error -- proving a prohibited field cannot ride along via `common`.
        extraSecret: 'should-never-appear',
      },
      { eventId: 'event-1', occurredAt: '2026-01-01T00:00:00.000Z' },
    );
    expect(Object.keys(full).sort()).toEqual(
      ['anonymousId', 'eventId', 'name', 'occurredAt', 'properties', 'sessionId'].sort(),
    );
    expect(JSON.stringify(full)).not.toContain('extraSecret');
  });

  it('omits optional common fields entirely rather than sending them as undefined', () => {
    const full = buildFullEvent(
      { name: 'export_failed', properties: { reason: 'unknown' } },
      { anonymousId: 'anon-1234' },
      { eventId: 'event-2', occurredAt: '2026-01-01T00:00:00.000Z' },
    );
    expect('sessionId' in full).toBe(false);
    expect('experimentRef' in full).toBe(false);
    expect('variant' in full).toBe(false);
    expect('appVersion' in full).toBe(false);
    expect('source' in full).toBe(false);
  });
});
