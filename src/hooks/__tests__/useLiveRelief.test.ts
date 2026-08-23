import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLiveRelief, type UseLiveReliefOptions } from '../useLiveRelief';
import { DEFAULT_RELIEF_SETTINGS } from '@/domain/types';
import { ZERO_ROTATION } from '@/state/appState';
import type { ProcessResponse } from '@/workers/processing.worker';
import type { DepthCaptureResult } from '@/three/depthCapture';

/** A promise plus externally-callable resolve/reject, for controlling
 * exactly when `process()` "completes" in a test -- needed to reproduce
 * an out-of-order-completion race deterministically. */
function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (err: Error) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (err: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const FAKE_CAPTURED: DepthCaptureResult = {
  width: 4,
  height: 4,
  depth: new Float32Array(16),
  emptyValue: -1,
};

function makeResponse(requestId: string): ProcessResponse {
  return {
    type: 'processed',
    requestId,
    heightIndex: new Int16Array(16),
    levels: [],
  };
}

function baseOptions(overrides: Partial<UseLiveReliefOptions> = {}): UseLiveReliefOptions {
  return {
    hasModel: true,
    reliefSettings: { ...DEFAULT_RELIEF_SETTINGS },
    rotationDeg: { ...ZERO_ROTATION },
    viewNonce: 0,
    needleGeometry: { diameterMm: 0, throwMm: 0 },
    patternDimensions: { widthCm: 20, heightCm: 20 },
    captureColor: false,
    capture: vi.fn(() => FAKE_CAPTURED),
    buildProcessArgs: vi.fn(() => ({
      depth: FAKE_CAPTURED.depth,
      width: FAKE_CAPTURED.width,
      height: FAKE_CAPTURED.height,
      emptyValue: FAKE_CAPTURED.emptyValue,
      settings: DEFAULT_RELIEF_SETTINGS,
      needleGeometry: { diameterMm: 0, throwMm: 0 },
      patternDimensions: { widthCm: 20, heightCm: 20 },
    })),
    process: vi.fn(() => Promise.resolve(makeResponse('r'))),
    onStart: vi.fn(),
    onSuccess: vi.fn(),
    onError: vi.fn(),
    debounceMs: 300,
    ...overrides,
  };
}

describe('useLiveRelief', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces rapid consecutive changes into a single capture+process call', async () => {
    const options = baseOptions();
    const { rerender } = renderHook((opts: UseLiveReliefOptions) => useLiveRelief(opts), {
      initialProps: options,
    });

    for (let levels = 3; levels <= 6; levels++) {
      rerender({ ...options, reliefSettings: { ...options.reliefSettings, levels } });
      await vi.advanceTimersByTimeAsync(50); // well under the 300ms debounce
    }
    await vi.advanceTimersByTimeAsync(300);

    expect(options.capture).toHaveBeenCalledTimes(1);
    expect(options.process).toHaveBeenCalledTimes(1);
    expect(options.onStart).toHaveBeenCalledTimes(1);
    expect(options.onSuccess).toHaveBeenCalledTimes(1);
  });

  it('never calls capture/process when hasModel is false', async () => {
    const options = baseOptions({ hasModel: false });
    renderHook((opts: UseLiveReliefOptions) => useLiveRelief(opts), { initialProps: options });

    await vi.advanceTimersByTimeAsync(1000);

    expect(options.capture).not.toHaveBeenCalled();
    expect(options.onStart).not.toHaveBeenCalled();
  });

  it('skips onStart/process entirely when capture() returns null', async () => {
    const options = baseOptions({ capture: vi.fn(() => null) });
    renderHook((opts: UseLiveReliefOptions) => useLiveRelief(opts), { initialProps: options });

    await vi.advanceTimersByTimeAsync(300);

    expect(options.capture).toHaveBeenCalledTimes(1);
    expect(options.onStart).not.toHaveBeenCalled();
    expect(options.process).not.toHaveBeenCalled();
  });

  it('discards a stale result that resolves after a newer generation has started (out-of-order completion)', async () => {
    const deferredA = deferred<ProcessResponse>();
    const deferredB = deferred<ProcessResponse>();
    const processMock = vi
      .fn()
      .mockReturnValueOnce(deferredA.promise)
      .mockReturnValueOnce(deferredB.promise);
    const options = baseOptions({ process: processMock });

    const { rerender } = renderHook((opts: UseLiveReliefOptions) => useLiveRelief(opts), {
      initialProps: options,
    });

    // Trigger A, let its debounce fire so process() is called and pending.
    await vi.advanceTimersByTimeAsync(300);
    expect(processMock).toHaveBeenCalledTimes(1);

    // Trigger B (a real settings change) while A is still in flight.
    rerender({ ...options, reliefSettings: { ...options.reliefSettings, levels: 9 } });
    await vi.advanceTimersByTimeAsync(300);
    expect(processMock).toHaveBeenCalledTimes(2);

    // Resolve A *after* B has already started -- A's result must be
    // discarded since a newer generation (B) is now current.
    deferredA.resolve(makeResponse('a'));
    await Promise.resolve();
    await Promise.resolve();
    expect(options.onSuccess).not.toHaveBeenCalled();

    // Now resolve B -- its result must be applied.
    deferredB.resolve(makeResponse('b'));
    await Promise.resolve();
    await Promise.resolve();
    expect(options.onSuccess).toHaveBeenCalledTimes(1);
    expect(options.onSuccess).toHaveBeenCalledWith(makeResponse('b'), 4, 4);
  });

  it('discards a stale error the same way a stale success is discarded', async () => {
    const deferredA = deferred<ProcessResponse>();
    const options = baseOptions({
      process: vi
        .fn()
        .mockReturnValueOnce(deferredA.promise)
        .mockReturnValueOnce(Promise.resolve(makeResponse('b'))),
    });

    const { rerender } = renderHook((opts: UseLiveReliefOptions) => useLiveRelief(opts), {
      initialProps: options,
    });

    await vi.advanceTimersByTimeAsync(300);
    rerender({ ...options, reliefSettings: { ...options.reliefSettings, levels: 9 } });
    await vi.advanceTimersByTimeAsync(300);

    deferredA.reject(new Error('stale failure'));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(options.onError).not.toHaveBeenCalled();
    expect(options.onSuccess).toHaveBeenCalledTimes(1);
  });

  it('clears a pending debounce timer on unmount without ever calling capture', async () => {
    const options = baseOptions();
    const { unmount } = renderHook((opts: UseLiveReliefOptions) => useLiveRelief(opts), {
      initialProps: options,
    });

    unmount();
    await vi.advanceTimersByTimeAsync(1000);

    expect(options.capture).not.toHaveBeenCalled();
  });

  it('re-triggers on a rotation change alone, independent of reliefSettings', async () => {
    const options = baseOptions();
    const { rerender } = renderHook((opts: UseLiveReliefOptions) => useLiveRelief(opts), {
      initialProps: options,
    });
    await vi.advanceTimersByTimeAsync(300);
    expect(options.capture).toHaveBeenCalledTimes(1);

    rerender({ ...options, rotationDeg: { roll: 45, pitch: 0, yaw: 0 } });
    await vi.advanceTimersByTimeAsync(300);

    expect(options.capture).toHaveBeenCalledTimes(2);
  });

  // Regression test: `viewNonce` is the signal that closes the "clicking a
  // standard-view button never re-captures" bug (docs/DECISIONS.md) --
  // `Viewport3D`'s `goToView`/OrbitControls mutate the Three.js camera with
  // no React state of their own, so `App.tsx` bumps this plain counter on
  // every user-driven camera-orientation change and feeds it through here,
  // the same way `rotationDeg` already covers mesh straightening. Without
  // this field in the effect's dependency array, a `viewNonce`-only change
  // (reliefSettings/rotationDeg untouched) would never re-trigger a
  // capture -- exactly reproducing the diagnosed bug at the unit level.
  it('re-triggers on a viewNonce change alone, independent of reliefSettings/rotationDeg', async () => {
    const options = baseOptions();
    const { rerender } = renderHook((opts: UseLiveReliefOptions) => useLiveRelief(opts), {
      initialProps: options,
    });
    await vi.advanceTimersByTimeAsync(300);
    expect(options.capture).toHaveBeenCalledTimes(1);

    // Simulate a standard-view button click: only viewNonce changes.
    rerender({ ...options, viewNonce: options.viewNonce + 1 });
    await vi.advanceTimersByTimeAsync(300);

    expect(options.capture).toHaveBeenCalledTimes(2);
  });

  it('re-triggers on a needleGeometry change alone, independent of reliefSettings', async () => {
    const options = baseOptions();
    const { rerender } = renderHook((opts: UseLiveReliefOptions) => useLiveRelief(opts), {
      initialProps: options,
    });
    await vi.advanceTimersByTimeAsync(300);
    expect(options.capture).toHaveBeenCalledTimes(1);

    rerender({ ...options, needleGeometry: { diameterMm: 2, throwMm: 40 } });
    await vi.advanceTimersByTimeAsync(300);

    expect(options.capture).toHaveBeenCalledTimes(2);
  });

  it('re-triggers on a patternDimensions change alone, independent of reliefSettings', async () => {
    const options = baseOptions();
    const { rerender } = renderHook((opts: UseLiveReliefOptions) => useLiveRelief(opts), {
      initialProps: options,
    });
    await vi.advanceTimersByTimeAsync(300);
    expect(options.capture).toHaveBeenCalledTimes(1);

    rerender({ ...options, patternDimensions: { widthCm: 30, heightCm: 30 } });
    await vi.advanceTimersByTimeAsync(300);

    expect(options.capture).toHaveBeenCalledTimes(2);
  });
});
