/**
 * Suggest a default punching order. The product spec is explicit that this
 * is *a* reasonable default (large low/background regions before small
 * raised details), not a universal rule -- the returned object always
 * carries that caveat text for display alongside the order.
 */

export interface PunchOrderStep {
  regionId: string;
  areaPx: number;
  heightIndex: number;
}

export interface PunchOrderResult {
  steps: PunchOrderStep[];
  caveat: string;
}

export function suggestPunchOrder(
  regions: { regionId: string; areaPx: number; heightIndex: number }[],
): PunchOrderResult {
  // Larger area first, then lower height first, as a readable tiebreak --
  // both are heuristics, not manufacturing requirements.
  const steps = [...regions].sort((a, b) => {
    if (a.heightIndex !== b.heightIndex) return a.heightIndex - b.heightIndex;
    return b.areaPx - a.areaPx;
  });
  return {
    steps,
    caveat:
      'Suggested order: large low/background regions before small raised details. ' +
      'This is a common-sense default, not a universal punch-needle rule -- adjust for your ' +
      'own technique, especially around overlapping or layered regions.',
  };
}
