import { afterEach, describe, expect, it } from 'vitest';
import { PSEUDONYMOUS_ID_PATTERN } from '@/analytics/contract';
import {
  clearAnonymousId,
  createAnonymousId,
  generateRandomId,
  getAnonymousId,
  getOrCreateSessionId,
} from '@/analytics/ids';

describe('ids', () => {
  afterEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('generates IDs matching the contract pseudonymous-ID shape', () => {
    const id = generateRandomId();
    expect(id).toMatch(PSEUDONYMOUS_ID_PATTERN);
    expect(generateRandomId()).not.toBe(id);
  });

  it('has no anonymous ID until one is created', () => {
    expect(getAnonymousId()).toBeNull();
  });

  it('creates and persists an anonymous ID in localStorage', () => {
    const id = createAnonymousId();
    expect(getAnonymousId()).toBe(id);
    expect(window.localStorage.getItem('prs:analytics:anonymous-id:v1')).toBe(id);
  });

  it('clears the anonymous ID on opt-out', () => {
    createAnonymousId();
    clearAnonymousId();
    expect(getAnonymousId()).toBeNull();
  });

  it('creates a session ID once per session and reuses it thereafter', () => {
    const first = getOrCreateSessionId();
    const second = getOrCreateSessionId();
    expect(first).toBe(second);
    expect(first).toMatch(PSEUDONYMOUS_ID_PATTERN);
  });

  it('keeps anonymousId (localStorage) and sessionId (sessionStorage) independent', () => {
    const anon = createAnonymousId();
    const session = getOrCreateSessionId();
    expect(anon).not.toBe(session);
    expect(window.sessionStorage.getItem('prs:analytics:anonymous-id:v1')).toBeNull();
    expect(window.localStorage.getItem('prs:analytics:session-id:v1')).toBeNull();
  });
});
