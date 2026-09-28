import { afterEach, describe, expect, it } from 'vitest';
import { hasSeenFirstProjectGuide, markFirstProjectGuideSeen } from '../firstProjectGuideStore';

describe('firstProjectGuideStore', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('reports not seen before anything is stored', () => {
    expect(hasSeenFirstProjectGuide()).toBe(false);
  });

  it('reports seen after marking, and persists across calls', () => {
    markFirstProjectGuideSeen();
    expect(hasSeenFirstProjectGuide()).toBe(true);
    expect(hasSeenFirstProjectGuide()).toBe(true);
  });

  it('accepts an injected storage, independent of window.localStorage', () => {
    const fake = new Map<string, string>();
    const storage: Storage = {
      getItem: (key) => fake.get(key) ?? null,
      setItem: (key, value) => {
        fake.set(key, value);
      },
      removeItem: (key) => {
        fake.delete(key);
      },
      clear: () => fake.clear(),
      key: () => null,
      length: 0,
    };
    expect(hasSeenFirstProjectGuide(storage)).toBe(false);
    markFirstProjectGuideSeen(storage);
    expect(hasSeenFirstProjectGuide(storage)).toBe(true);
    expect(hasSeenFirstProjectGuide()).toBe(false);
  });
});
