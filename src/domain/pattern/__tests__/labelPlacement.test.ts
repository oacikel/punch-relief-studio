import { describe, expect, it } from 'vitest';
import { placeLabels, type LabelCandidate } from '../labelPlacement';

const LABEL_HEIGHT = 14;
function labelWidth(id: string): number {
  return id.length * 7;
}

function overlaps(
  a: { x: number; y: number },
  b: { x: number; y: number },
  w = LABEL_HEIGHT * 3,
  h = LABEL_HEIGHT,
): boolean {
  return Math.abs(a.x - b.x) < w && Math.abs(a.y - b.y) < h;
}

describe('placeLabels', () => {
  it('returns an empty array for no candidates', () => {
    expect(placeLabels([], { labelWidth, labelHeight: LABEL_HEIGHT })).toEqual([]);
  });

  it('places a single candidate at its own anchor, unchanged', () => {
    const candidates: LabelCandidate[] = [{ id: 'C1-H1', x: 50, y: 50, areaPx: 200 }];
    const placed = placeLabels(candidates, { labelWidth, labelHeight: LABEL_HEIGHT });
    expect(placed).toEqual([{ id: 'C1-H1', x: 50, y: 50 }]);
  });

  it('keeps both labels at their own anchors when far apart (no collision)', () => {
    const candidates: LabelCandidate[] = [
      { id: 'C1-H1', x: 0, y: 0, areaPx: 200 },
      { id: 'C1-H2', x: 500, y: 500, areaPx: 200 },
    ];
    const placed = placeLabels(candidates, { labelWidth, labelHeight: LABEL_HEIGHT });
    expect(placed).toHaveLength(2);
    expect(placed.find((p) => p.id === 'C1-H1')).toEqual({ id: 'C1-H1', x: 0, y: 0 });
    expect(placed.find((p) => p.id === 'C1-H2')).toEqual({ id: 'C1-H2', x: 500, y: 500 });
  });

  it('nudges the smaller region label when two candidates would overlap, and produces no overlapping pair', () => {
    // Two candidates 3 units apart -- guaranteed to collide given a label
    // several times that wide.
    const candidates: LabelCandidate[] = [
      { id: 'C1-H1', x: 100, y: 100, areaPx: 5000 }, // bigger region -> keeps priority
      { id: 'C1-H2', x: 103, y: 100, areaPx: 40 }, // smaller region -> nudged
    ];
    const placed = placeLabels(candidates, { labelWidth, labelHeight: LABEL_HEIGHT });
    expect(placed).toHaveLength(2);

    const big = placed.find((p) => p.id === 'C1-H1');
    const small = placed.find((p) => p.id === 'C1-H2');
    expect(big).toEqual({ id: 'C1-H1', x: 100, y: 100 }); // priority label unchanged
    expect(small).not.toEqual({ id: 'C1-H2', x: 103, y: 100 }); // had to move
    expect(overlaps(big as { x: number; y: number }, small as { x: number; y: number })).toBe(
      false,
    );
  });

  it('drops a label rather than rendering it overlapping when a tight cluster has no room', () => {
    // A tight cluster of many same-sized tiny candidates, all within a couple
    // of units of each other -- more labels than can possibly fit without
    // overlap at this label size, even after nudging.
    const candidates: LabelCandidate[] = Array.from({ length: 12 }, (_, i) => ({
      id: `C1-H${i + 1}`,
      x: 100 + (i % 4),
      y: 100 + Math.floor(i / 4),
      areaPx: 40,
    }));
    const placed = placeLabels(candidates, { labelWidth, labelHeight: LABEL_HEIGHT });

    expect(placed.length).toBeLessThan(candidates.length);
    expect(placed.length).toBeGreaterThan(0);

    // No two placed labels may overlap (AABB test using the same footprint
    // placeLabels itself uses, plus its gap).
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i] as { id: string; x: number; y: number };
        const b = placed[j] as { id: string; x: number; y: number };
        const w = (labelWidth(a.id) + labelWidth(b.id)) / 2;
        expect(overlaps(a, b, w, LABEL_HEIGHT)).toBe(false);
      }
    }
  });

  it('is deterministic -- the same input always produces the same output', () => {
    const candidates: LabelCandidate[] = [
      { id: 'C1-H1', x: 10, y: 10, areaPx: 500 },
      { id: 'C2-H1', x: 12, y: 10, areaPx: 300 },
      { id: 'C1-H2', x: 11, y: 12, areaPx: 100 },
    ];
    const first = placeLabels(candidates, { labelWidth, labelHeight: LABEL_HEIGHT });
    const second = placeLabels(candidates, { labelWidth, labelHeight: LABEL_HEIGHT });
    expect(second).toEqual(first);
  });

  it('never places a label box outside the given canvas bounds', () => {
    // Anchored right at the top-left corner -- the unmoved centroid position
    // would put roughly half the label box off-canvas (negative x/y).
    const candidates: LabelCandidate[] = [{ id: 'C1-H1', x: 1, y: 1, areaPx: 500 }];
    const bounds = { width: 200, height: 200 };
    const placed = placeLabels(candidates, {
      labelWidth,
      labelHeight: LABEL_HEIGHT,
      bounds,
    });
    expect(placed).toHaveLength(1);
    const p = placed[0] as { id: string; x: number; y: number };
    const w = labelWidth('C1-H1');
    expect(p.x - w / 2).toBeGreaterThanOrEqual(0);
    expect(p.y - LABEL_HEIGHT / 2).toBeGreaterThanOrEqual(0);
  });

  it('drops a label rather than placing it out of bounds when no in-bounds spot exists nearby', () => {
    // A 1x1 canvas can never fit even the smallest label box anywhere.
    const candidates: LabelCandidate[] = [{ id: 'C1-H1', x: 0.5, y: 0.5, areaPx: 500 }];
    const placed = placeLabels(candidates, {
      labelWidth,
      labelHeight: LABEL_HEIGHT,
      bounds: { width: 1, height: 1 },
    });
    expect(placed).toEqual([]);
  });

  it('places without any bounds check when bounds is omitted (unchanged prior behavior)', () => {
    const candidates: LabelCandidate[] = [{ id: 'C1-H1', x: 0, y: 0, areaPx: 500 }];
    const placed = placeLabels(candidates, { labelWidth, labelHeight: LABEL_HEIGHT });
    expect(placed).toEqual([{ id: 'C1-H1', x: 0, y: 0 }]);
  });

  it('prioritizes the larger region when two equal-priority candidates tie, using id as a stable tiebreaker', () => {
    const candidates: LabelCandidate[] = [
      { id: 'C2-H1', x: 100, y: 100, areaPx: 500 },
      { id: 'C1-H1', x: 101, y: 100, areaPx: 500 },
    ];
    const placed = placeLabels(candidates, { labelWidth, labelHeight: LABEL_HEIGHT });
    const c1 = placed.find((p) => p.id === 'C1-H1');
    // 'C1-H1' sorts before 'C2-H1' alphabetically, so it wins the tiebreak
    // and keeps its own anchor unchanged.
    expect(c1).toEqual({ id: 'C1-H1', x: 101, y: 100 });
  });
});
