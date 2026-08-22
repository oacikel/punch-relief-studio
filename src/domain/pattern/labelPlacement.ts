/**
 * Pure collision-avoidance geometry for the pattern's per-region "C{n}-H{n}"
 * labels (Iteration 03 Round 2 #4). `buildLabels` in `src/export/svgPattern.ts`
 * computes each region's centroid-anchored candidate position in already-
 * rendered SVG units (using the pattern's real cellW/cellH, i.e. what will
 * actually appear on screen/print), then calls `placeLabels` here to resolve
 * overlaps before emitting `<text>` markup. Kept as a standalone domain
 * module -- no SVG string building, no DOM -- so the placement algorithm is
 * unit-testable on its own, matching the existing split between
 * `punchGuide.ts` (geometry) and `svgPattern.ts` (rendering).
 *
 * Why this exists: the previous implementation placed every region's label
 * at its centroid unconditionally. For small or thin regions -- exactly the
 * regions where a label matters most, since CLAUDE.md requires a symbol/ID
 * pairing wherever color alone can't distinguish regions -- neighboring
 * labels routinely rendered on top of each other and became illegible,
 * which functionally fails that requirement even though a label was
 * technically drawn. See docs/DECISIONS.md for the chosen strategy
 * (deterministic nudge search, drop-if-still-crowded) versus the
 * alternatives considered (leader lines, a stricter size-only gate).
 *
 * `LabelPlacementOptions.bounds`, when given, keeps every placed label's
 * full box inside the canvas -- a nudge that would push a label partway
 * off-canvas is treated as a collision, not accepted, since an SVG's
 * default overflow clipping would otherwise silently truncate it (a label
 * a viewer can't see is no better than one that was dropped outright).
 */

export interface LabelCandidate {
  id: string;
  /** Candidate anchor position, in the same rendered units the caller will
   * draw with (e.g. SVG user units after cellW/cellH scaling). */
  x: number;
  y: number;
  /** Raw pixel area of the source region -- used only to decide placement
   * priority (larger regions keep their exact preferred spot; smaller ones
   * get nudged or dropped first when two candidates conflict). */
  areaPx: number;
}

export interface PlacedLabel {
  id: string;
  x: number;
  y: number;
}

export interface LabelPlacementOptions {
  /** Estimated rendered label width for a given id string, in the same
   * units as candidate x/y. Takes a function (not a single number) since
   * "C1-H1" and "C12-H12" render at different widths. */
  labelWidth: (id: string) => number;
  /** Estimated rendered label height, in the same units as candidate x/y. */
  labelHeight: number;
  /** Minimum visual gap enforced between two placed label boxes, on top of
   * their own footprints -- prevents labels from reading as touching/fused
   * even when technically non-overlapping. */
  gap?: number;
  /** Concentric ring radii (as multiples of `labelHeight`) tried around a
   * candidate's own anchor before giving up on it. Kept small and finite so
   * placement stays deterministic and bounded rather than an open-ended
   * solver -- a label that can't find room nearby is dropped, not chased
   * arbitrarily far from the region it identifies. */
  searchRingMultiples?: number[];
  /** The renderable canvas extent, in the same units as candidate x/y. When
   * given, a candidate position is only accepted if its full label box
   * (including gap) fits entirely within `[0, width] x [0, height]` --
   * otherwise it's treated exactly like an overlap and the search moves on
   * to the next offset (or drops the label if none are in-bounds). Without
   * this, a region anchored near the canvas edge could nudge its label
   * partway off-canvas, where an SVG's default overflow clipping would
   * silently truncate it -- a label a caller can't see is no better than
   * one it dropped outright. Omit to place without any bounds check. */
  bounds?: { width: number; height: number };
}

const DEFAULT_GAP = 2;
const DEFAULT_SEARCH_RING_MULTIPLES = [1, 2, 3];
// 8-direction compass search at each ring radius -- enough to usually find
// a free spot next to a crowded region without the search becoming
// expensive or drifting the label somewhere unrelated-looking.
const RAW_DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];

function normalize(dx: number, dy: number): [number, number] {
  const len = Math.hypot(dx, dy) || 1;
  return [dx / len, dy / len];
}

const COMPASS_DIRECTIONS: Array<[number, number]> = RAW_DIRECTIONS.map(([dx, dy]) =>
  normalize(dx, dy),
);

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function boxFor(x: number, y: number, w: number, h: number, gap: number): Box {
  const hw = w / 2 + gap / 2;
  const hh = h / 2 + gap / 2;
  return { x0: x - hw, y0: y - hh, x1: x + hw, y1: y + hh };
}

function boxesOverlap(a: Box, b: Box): boolean {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

function boxWithinBounds(box: Box, bounds: { width: number; height: number }): boolean {
  return box.x0 >= 0 && box.y0 >= 0 && box.x1 <= bounds.width && box.y1 <= bounds.height;
}

/**
 * Resolves label overlaps deterministically: bigger regions place first (a
 * stable sort, tie-broken by id so results never depend on input order
 * alone). Each candidate first tries its own centroid; if that collides
 * with an already-placed label, a small fixed set of nudge offsets is
 * tried in order; if none are free, the label is dropped entirely rather
 * than rendered overlapping and unreadable.
 */
export function placeLabels(
  candidates: LabelCandidate[],
  options: LabelPlacementOptions,
): PlacedLabel[] {
  const gap = options.gap ?? DEFAULT_GAP;
  const ringMultiples = options.searchRingMultiples ?? DEFAULT_SEARCH_RING_MULTIPLES;

  const ordered = [...candidates].sort((a, b) => b.areaPx - a.areaPx || a.id.localeCompare(b.id));

  const placedBoxes: Box[] = [];
  const result: PlacedLabel[] = [];

  for (const candidate of ordered) {
    const w = options.labelWidth(candidate.id);
    const h = options.labelHeight;
    const offsets: Array<[number, number]> = [[0, 0]];
    for (const ring of ringMultiples) {
      const radius = ring * h;
      for (const [dx, dy] of COMPASS_DIRECTIONS) {
        offsets.push([dx * radius, dy * radius]);
      }
    }

    let placed: { x: number; y: number } | null = null;
    for (const [dx, dy] of offsets) {
      const x = candidate.x + dx;
      const y = candidate.y + dy;
      const box = boxFor(x, y, w, h, gap);
      if (options.bounds && !boxWithinBounds(box, options.bounds)) continue;
      if (!placedBoxes.some((existing) => boxesOverlap(existing, box))) {
        placed = { x, y };
        placedBoxes.push(box);
        break;
      }
    }

    if (placed) {
      result.push({ id: candidate.id, x: placed.x, y: placed.y });
    }
    // No free spot found nearby -- skip rather than render an illegible,
    // overlapping label. The region itself is still visually distinct via
    // its fill/outline; only the redundant text label is omitted.
  }

  return result;
}
