/**
 * Deterministic pseudo-random source. Anything in this app that would
 * otherwise use Math.random() (k-means-style initialization, procedural
 * fibre noise seeding, etc.) must go through this so runs are reproducible
 * given the same input + settings, per the product's determinism
 * requirement.
 */

export interface Rng {
  next(): number; // [0, 1)
  nextInt(maxExclusive: number): number;
}

/** xorshift32 -- small, fast, fully deterministic for a given seed. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0 || 0x9e3779b9;

  function nextUint32(): number {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state;
  }

  return {
    next(): number {
      return nextUint32() / 0xffffffff;
    },
    nextInt(maxExclusive: number): number {
      if (maxExclusive <= 0) throw new Error('maxExclusive must be positive');
      return Math.floor(nextUint32() / 0xffffffff * maxExclusive) % maxExclusive;
    },
  };
}

/** Fixed default seed used whenever a caller doesn't provide one, so the
 * whole app is deterministic out of the box. */
export const DEFAULT_SEED = 0x50554e43; // 'PUNC'
