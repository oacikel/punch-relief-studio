/**
 * Anonymous/session ID management. `anonymousId` lives in localStorage and
 * is created only after consent is granted (never before, never for its
 * own sake). `sessionId` is random per tab, in sessionStorage, and doesn't
 * require consent to exist transiently -- it's only ever attached to an
 * event when `anonymousId` is also present, i.e. only after consent.
 */
const ANONYMOUS_ID_KEY = 'prs:analytics:anonymous-id:v1';
const SESSION_ID_KEY = 'prs:analytics:session-id:v1';

/** 32 lowercase-hex characters -- matches the contract's
 * `PseudonymousId` shape (`[A-Za-z0-9_-]{8,64}`) with room to spare. */
export function generateRandomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '');
  }
  let id = '';
  for (let i = 0; i < 32; i++) id += Math.floor(Math.random() * 16).toString(16);
  return id;
}

export function getAnonymousId(storage: Storage = window.localStorage): string | null {
  return storage.getItem(ANONYMOUS_ID_KEY);
}

export function createAnonymousId(storage: Storage = window.localStorage): string {
  const id = generateRandomId();
  storage.setItem(ANONYMOUS_ID_KEY, id);
  return id;
}

export function clearAnonymousId(storage: Storage = window.localStorage): void {
  storage.removeItem(ANONYMOUS_ID_KEY);
}

export function getOrCreateSessionId(storage: Storage = window.sessionStorage): string {
  const existing = storage.getItem(SESSION_ID_KEY);
  if (existing) return existing;
  const id = generateRandomId();
  storage.setItem(SESSION_ID_KEY, id);
  return id;
}
