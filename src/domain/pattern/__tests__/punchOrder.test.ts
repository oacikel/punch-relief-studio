import { describe, expect, it } from 'vitest';
import { suggestPunchOrder } from '../punchOrder';

describe('suggestPunchOrder', () => {
  it('orders lower height levels before higher ones', () => {
    const regions = [
      { regionId: 'C1-H3', areaPx: 100, heightIndex: 2 },
      { regionId: 'C1-H1', areaPx: 10, heightIndex: 0 },
      { regionId: 'C1-H2', areaPx: 50, heightIndex: 1 },
    ];
    const result = suggestPunchOrder(regions);
    expect(result.steps.map((s) => s.heightIndex)).toEqual([0, 1, 2]);
  });

  it('orders larger regions before smaller ones within the same height level', () => {
    const regions = [
      { regionId: 'C1-H1', areaPx: 10, heightIndex: 0 },
      { regionId: 'C2-H1', areaPx: 100, heightIndex: 0 },
    ];
    const result = suggestPunchOrder(regions);
    expect(result.steps[0].regionId).toBe('C2-H1');
  });

  it('always includes the caveat that this is a default, not a rule', () => {
    const result = suggestPunchOrder([]);
    expect(result.caveat.toLowerCase()).toContain('default');
  });
});
