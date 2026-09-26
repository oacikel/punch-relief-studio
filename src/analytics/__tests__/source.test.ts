import { afterEach, describe, expect, it } from 'vitest';
import {
  captureLandingContext,
  classifySource,
  getCachedExperiment,
  getCachedSource,
} from '@/analytics/source';

function params(query: string): URLSearchParams {
  return new URLSearchParams(query);
}

describe('classifySource', () => {
  it('classifies cpc/paid utm_medium as ad', () => {
    expect(classifySource('', params('utm_medium=cpc'))).toBe('ad');
    expect(classifySource('', params('utm_medium=paid'))).toBe('ad');
  });

  it('classifies known social hosts/utm as social', () => {
    expect(classifySource('https://www.instagram.com/p/xyz', params(''))).toBe('social');
    expect(classifySource('', params('utm_source=facebook.com'))).toBe('social');
  });

  it('classifies known search engines as search', () => {
    expect(classifySource('https://www.google.com/search?q=x', params(''))).toBe('search');
    expect(classifySource('https://duckduckgo.com/?q=x', params(''))).toBe('search');
  });

  it('classifies an unrecognized referring site as referral', () => {
    expect(classifySource('https://some-craft-blog.example/post', params(''))).toBe('referral');
  });

  it('classifies no referrer and no utm as direct', () => {
    expect(classifySource('', params(''))).toBe('direct');
  });

  it('falls back to other for an unparseable referrer', () => {
    expect(classifySource('not a url', params(''))).toBe('other');
  });
});

describe('landing context capture', () => {
  afterEach(() => {
    window.sessionStorage.clear();
  });

  it('captures source and experiment once and caches in sessionStorage', () => {
    Object.defineProperty(document, 'referrer', {
      value: 'https://www.google.com/search',
      configurable: true,
    });
    window.history.pushState({}, '', '/?exp=EXP-002&v=b');

    captureLandingContext();

    expect(getCachedSource()).toBe('search');
    expect(getCachedExperiment()).toEqual({ experimentRef: 'EXP-002', variant: 'b' });

    // A later call with different ambient signals must not overwrite the
    // cached, once-per-session values.
    Object.defineProperty(document, 'referrer', {
      value: 'https://facebook.com',
      configurable: true,
    });
    window.history.pushState({}, '', '/?exp=EXP-999&v=z');
    captureLandingContext();
    expect(getCachedSource()).toBe('search');
    expect(getCachedExperiment()).toEqual({ experimentRef: 'EXP-002', variant: 'b' });
  });

  it('ignores an experiment ref/variant that does not match the contract pattern', () => {
    Object.defineProperty(document, 'referrer', { value: '', configurable: true });
    window.history.pushState({}, '', '/?exp=not-valid&v=Also_Not_Valid!');
    captureLandingContext();
    expect(getCachedExperiment()).toEqual({});
  });

  it('never persists the query string or referrer URL itself', () => {
    Object.defineProperty(document, 'referrer', {
      value: 'https://www.google.com/search?q=secret+query',
      configurable: true,
    });
    window.history.pushState({}, '', '/?exp=EXP-002&v=b&sensitive=personal-data');
    captureLandingContext();
    const raw = JSON.stringify(window.sessionStorage);
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i);
      if (!key) continue;
      const value = window.sessionStorage.getItem(key) ?? '';
      expect(value).not.toContain('secret');
      expect(value).not.toContain('sensitive');
      expect(value).not.toContain('personal-data');
    }
    expect(raw).toBeDefined();
  });
});
