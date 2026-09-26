/**
 * Wires up automatic flush triggers: a periodic timer, and
 * `visibilitychange`/`pagehide` (the tab being backgrounded or closed is
 * exactly when a keepalive `fetch` is most likely to actually complete).
 * Idempotent -- safe to call multiple times (e.g. React StrictMode's
 * double-invoke, or repeated `initAnalytics()` calls); only the first call
 * actually attaches anything.
 */
import { flushQueue } from '@/analytics/transport';

const FLUSH_INTERVAL_MS = 15_000;

let started = false;

export function startFlushScheduler(): void {
  if (started) return;
  started = true;

  const trigger = (): void => {
    void flushQueue();
  };

  window.setInterval(trigger, FLUSH_INTERVAL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') trigger();
  });
  window.addEventListener('pagehide', trigger);
  window.addEventListener('online', trigger);
}

/** Test-only: lets tests re-invoke `startFlushScheduler` and observe a
 * fresh set of listeners rather than the idempotency guard silently
 * skipping. Does not remove already-attached listeners (jsdom test
 * teardown recreates the window per test file); it only resets this
 * module's own guard. */
export function resetFlushSchedulerForTests(): void {
  started = false;
}
