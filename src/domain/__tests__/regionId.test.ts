import { describe, expect, it } from 'vitest';
import { parseRegionId, regionId, symbolForHeight } from '../regionId';

describe('regionId', () => {
  it('formats as C{n}-H{n} with 1-based display indices', () => {
    expect(regionId(0, 0)).toBe('C1-H1');
    expect(regionId(2, 3)).toBe('C3-H4');
  });

  it('uses a placeholder for background/unassigned indices', () => {
    expect(regionId(-1, 2)).toBe('C--H3');
  });

  it('round-trips through parseRegionId', () => {
    const id = regionId(4, 1);
    expect(parseRegionId(id)).toEqual({ colorIndex: 4, heightIndex: 1 });
  });

  it('returns null for a malformed id', () => {
    expect(parseRegionId('not-an-id')).toBeNull();
  });
});

describe('symbolForHeight', () => {
  it('is deterministic for a given height index', () => {
    expect(symbolForHeight(2)).toBe(symbolForHeight(2));
  });

  it('cycles rather than throwing for out-of-range indices', () => {
    expect(() => symbolForHeight(50)).not.toThrow();
  });
});
