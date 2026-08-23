/**
 * Connected-component analysis and tiny-region cleanup on a quantized
 * height-index (or color-index) raster. Regions smaller than the
 * configured minimum pixel count are reassigned to their largest
 * neighboring region, so the final pattern has no impractically small
 * islands.
 */

export interface Component {
  id: number;
  levelValue: number; // the heightIndex/colorIndex this component shares
  pixels: number[]; // flat indices
}

/** 4-connected flood fill labeling. Deterministic: scans row-major, so
 * component IDs and pixel-visit order are stable across runs. */
export function findConnectedComponents(
  index: Int16Array,
  width: number,
  height: number,
): Component[] {
  const visited = new Uint8Array(index.length);
  const components: Component[] = [];
  let nextId = 0;

  for (let start = 0; start < index.length; start++) {
    if (visited[start] === 1) continue;
    const value = index[start] as number;
    visited[start] = 1;
    if (value === -1) continue; // background is never a "region"

    const pixels: number[] = [start];
    const stack = [start];
    while (stack.length > 0) {
      const i = stack.pop() as number;
      const x = i % width;
      const y = Math.floor(i / width);
      const neighbors = [
        x > 0 ? i - 1 : -1,
        x < width - 1 ? i + 1 : -1,
        y > 0 ? i - width : -1,
        y < height - 1 ? i + width : -1,
      ];
      for (const n of neighbors) {
        if (n < 0 || visited[n] === 1) continue;
        if (index[n] === value) {
          visited[n] = 1;
          pixels.push(n);
          stack.push(n);
        }
      }
    }
    components.push({ id: nextId++, levelValue: value, pixels });
  }
  return components;
}

/**
 * Reassign pixels of components smaller than `minSizePx` to the value of
 * their largest bordering component. Iterates smallest-first so cleanup
 * cascades sensibly; components with no valid (non-background) neighbor
 * are left unchanged rather than deleted, avoiding data loss.
 */
export function cleanupTinyRegions(
  index: Int16Array,
  width: number,
  height: number,
  minSizePx: number,
): Int16Array {
  if (minSizePx <= 1) return index;
  const result = index.slice();
  let components = findConnectedComponents(result, width, height);
  let changed = true;
  let guard = 0;

  while (changed && guard < 20) {
    changed = false;
    guard++;
    components = findConnectedComponents(result, width, height);
    const small = components.filter((c) => c.pixels.length < minSizePx);
    small.sort((a, b) => a.pixels.length - b.pixels.length);

    for (const comp of small) {
      const neighborCounts = new Map<number, number>();
      for (const i of comp.pixels) {
        const x = i % width;
        const y = Math.floor(i / width);
        const neighbors = [
          x > 0 ? i - 1 : -1,
          x < width - 1 ? i + 1 : -1,
          y > 0 ? i - width : -1,
          y < height - 1 ? i + width : -1,
        ];
        for (const n of neighbors) {
          if (n < 0) continue;
          const v = result[n] as number;
          if (v === comp.levelValue || v === -1) continue;
          neighborCounts.set(v, (neighborCounts.get(v) ?? 0) + 1);
        }
      }
      if (neighborCounts.size === 0) continue;
      let bestValue = comp.levelValue;
      let bestCount = -1;
      for (const [value, count] of neighborCounts) {
        if (count > bestCount) {
          bestCount = count;
          bestValue = value;
        }
      }
      if (bestValue !== comp.levelValue) {
        for (const i of comp.pixels) result[i] = bestValue;
        changed = true;
      }
    }
  }
  return result;
}

/**
 * Chessboard (Chebyshev) distance transform: for every cell where `mask`
 * is truthy, the distance (in 8-connected steps) to the nearest falsy
 * cell. Falsy cells themselves get distance 0. A cheaper, honestly-
 * documented stand-in for a true Euclidean distance transform -- see
 * `applyNeedleWidthOpening` below for why the approximation (a square-ish
 * rather than circular "needle footprint") is an acceptable trade-off
 * here, matching this codebase's existing pattern of documented
 * approximations (e.g. `smoothRelief`'s "not a true bilateral filter").
 *
 * `treatOutOfBoundsAsZero` (default `true`) treats the raster's own edge
 * as if a falsy cell sat just outside it -- appropriate when `mask` marks
 * "this pile-height level," since a region touching the canvas edge
 * should need the same margin from that edge as from a real boundary.
 * Pass `false` when `mask` instead marks an arbitrary target set (e.g.
 * "already-resolved pixels") that has nothing to do with the canvas edge.
 *
 * Two-pass (forward then backward raster scan) chamfer algorithm on a
 * 1-cell-padded copy of `mask`, so the real cells never need special-cased
 * boundary math. O(width*height).
 */
export function chebyshevDistanceTransform(
  mask: Uint8Array,
  width: number,
  height: number,
  treatOutOfBoundsAsZero = true,
): Int32Array {
  const INF = 1 << 29;
  const pw = width + 2;
  const ph = height + 2;
  const padValue = treatOutOfBoundsAsZero ? 0 : INF;
  const dist = new Int32Array(pw * ph).fill(padValue);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      dist[(y + 1) * pw + (x + 1)] = mask[y * width + x] ? INF : 0;
    }
  }

  for (let y = 1; y < ph - 1; y++) {
    for (let x = 1; x < pw - 1; x++) {
      const i = y * pw + x;
      if (dist[i] === 0) continue;
      const a = dist[i - 1] as number;
      const b = dist[i - pw] as number;
      const c = dist[i - pw - 1] as number;
      const d = dist[i - pw + 1] as number;
      dist[i] = Math.min(dist[i] as number, a + 1, b + 1, c + 1, d + 1);
    }
  }
  for (let y = ph - 2; y >= 1; y--) {
    for (let x = pw - 2; x >= 1; x--) {
      const i = y * pw + x;
      if (dist[i] === 0) continue;
      const a = dist[i + 1] as number;
      const b = dist[i + pw] as number;
      const c = dist[i + pw - 1] as number;
      const d = dist[i + pw + 1] as number;
      dist[i] = Math.min(dist[i] as number, a + 1, b + 1, c + 1, d + 1);
    }
  }

  const result = new Int32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      result[y * width + x] = dist[(y + 1) * pw + (x + 1)] as number;
    }
  }
  return result;
}

/**
 * Needle-diameter-driven width floor (docs/ITERATION_04_PLAN.md), enforced
 * as a genuine local-thickness check -- a morphological *opening* per pile-
 * height level -- rather than the whole-component pixel-*area* check
 * `cleanupTinyRegions` does. Area alone is not enough: a region can have
 * plenty of total area while still having a neck or spike narrower than
 * the needle allows (a long, thin protrusion off an otherwise-large blob),
 * which an area threshold never catches. This does:
 *
 * 1. Per level with a positive radius, erode that level's mask (keep only
 *    pixels whose `chebyshevDistanceTransform` to the level's own boundary
 *    exceeds the radius -- i.e., comfortably interior) and dilate the
 *    survivors back out by the same radius, but never past that level's
 *    own footprint. Pixels of the level that fall outside this "opened"
 *    result are the too-thin ones -- the classic opening definition,
 *    applied per level instead of to a single binary mask.
 * 2. Every too-thin pixel (across every level) is reassigned in one
 *    multi-source BFS "region growing" pass from all pixels that *did*
 *    survive their level's opening -- each too-thin pixel takes the value
 *    of whichever survives-opening pixel (any level) is nearest, so a
 *    narrow neck reads as an extension of whichever side it's actually
 *    closest to. A too-thin pixel with no reachable survivor anywhere
 *    (background on every side) is left at its original value, matching
 *    `cleanupTinyRegions`' own no-data-loss philosophy.
 *
 * `radiusForLevel(levelValue)` returns the erosion/dilation radius for
 * that level, in pixels -- roughly half the needle-driven minimum width in
 * px (see `src/domain/pattern/needleGeometry.ts`'s `minWidthPxForLevel`);
 * `<= 0` means "no constraint for this level." Background (`-1`) is never
 * a source or a target.
 *
 * A large enough radius can leave a level (or, in the extreme, every
 * level at once) with *zero* erosion survivors anywhere -- nothing deep
 * enough to seed the region-growing pass at all. Left alone, that would
 * mean the too-thin pixels have no "kept" pixel to grow from and stay
 * exactly as they started: a too-strict constraint silently producing
 * *less* simplification than a milder one, not more (found via a real
 * needle spec that made this concrete: an oddly large diameter looked
 * *more* detailed than a moderate one -- see docs/DECISIONS.md). A second
 * pass after the region-growing BFS catches exactly this: any pixels the
 * BFS never reached (because no survivor was reachable) are grouped into
 * connected components and reassigned to whichever already-resolved
 * bordering value is most common, the same border-majority rule
 * `cleanupTinyRegions` already uses -- repeated (bounded to 20 rounds,
 * same guard `cleanupTinyRegions` uses) since resolving one component can
 * newly border another. A component that never borders anything resolved
 * (fully enclosed by other still-unresolved pixels and/or background) is
 * left at its original value, same no-data-loss fallback as
 * `cleanupTinyRegions`.
 */
export function applyNeedleWidthOpening(
  index: Int16Array,
  width: number,
  height: number,
  radiusForLevel: (levelValue: number) => number,
): Int16Array {
  const n = width * height;
  const result = index.slice();

  const levelsPresent = new Set<number>();
  for (let i = 0; i < n; i++) {
    const v = result[i] as number;
    if (v !== -1) levelsPresent.add(v);
  }

  const keep = new Uint8Array(n).fill(1);
  let anyConstraint = false;

  for (const levelValue of levelsPresent) {
    const r = radiusForLevel(levelValue);
    if (r <= 0) continue;
    anyConstraint = true;

    const levelMask = new Uint8Array(n);
    for (let i = 0; i < n; i++) levelMask[i] = result[i] === levelValue ? 1 : 0;
    const distToBoundary = chebyshevDistanceTransform(levelMask, width, height, true);

    const erosionSurvivor = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      erosionSurvivor[i] = levelMask[i] && (distToBoundary[i] as number) > r ? 1 : 0;
    }

    // Distance from every cell to the nearest erosion survivor -- the
    // canvas edge must NOT act as an implicit survivor here (unlike the
    // boundary transform above), so treatOutOfBoundsAsZero is false.
    const survivorTarget = new Uint8Array(n);
    for (let i = 0; i < n; i++) survivorTarget[i] = erosionSurvivor[i] ? 0 : 1;
    const distToSurvivor = chebyshevDistanceTransform(survivorTarget, width, height, false);

    for (let i = 0; i < n; i++) {
      if (!levelMask[i]) continue;
      const opened = (distToSurvivor[i] as number) <= r;
      if (!opened) keep[i] = 0;
    }
  }

  if (!anyConstraint) return result;

  // Multi-source BFS region growing: every kept, non-background pixel
  // seeds the flood; each too-thin pixel takes the value of whichever
  // wave reaches it first, which (since sources are enqueued in row-major
  // order and neighbors are visited in lockstep) is deterministic for a
  // given input.
  const visited = new Uint8Array(n);
  const queue: number[] = [];
  for (let i = 0; i < n; i++) {
    if (result[i] !== -1 && keep[i] === 1) {
      visited[i] = 1;
      queue.push(i);
    }
  }
  let head = 0;
  while (head < queue.length) {
    const i = queue[head++] as number;
    const x = i % width;
    const y = Math.floor(i / width);
    const neighbors = [
      x > 0 ? i - 1 : -1,
      x < width - 1 ? i + 1 : -1,
      y > 0 ? i - width : -1,
      y < height - 1 ? i + width : -1,
    ];
    for (const nb of neighbors) {
      if (nb < 0 || visited[nb] === 1) continue;
      if (result[nb] === -1) continue; // never grow into background
      visited[nb] = 1;
      result[nb] = result[i] as number;
      queue.push(nb);
    }
  }

  // Fallback pass: anything the BFS never reached (no survivor was
  // reachable, possibly because none existed anywhere for that level) is
  // still sitting at its original, too-thin value. Resolve these the same
  // way cleanupTinyRegions resolves an undersized component: border-
  // majority against whatever's already settled, repeated since resolving
  // one component can newly border another.
  let changed = true;
  let guard = 0;
  while (changed && guard < 20) {
    changed = false;
    guard++;
    const seen = new Uint8Array(n);
    for (let start = 0; start < n; start++) {
      if (seen[start] === 1 || visited[start] === 1 || result[start] === -1) continue;
      const levelValue = result[start] as number;
      const pixels: number[] = [start];
      seen[start] = 1;
      const stack = [start];
      while (stack.length > 0) {
        const i = stack.pop() as number;
        const x = i % width;
        const y = Math.floor(i / width);
        const neighbors = [
          x > 0 ? i - 1 : -1,
          x < width - 1 ? i + 1 : -1,
          y > 0 ? i - width : -1,
          y < height - 1 ? i + width : -1,
        ];
        for (const nb of neighbors) {
          if (nb < 0 || seen[nb] === 1 || visited[nb] === 1) continue;
          if (result[nb] !== levelValue) continue;
          seen[nb] = 1;
          pixels.push(nb);
          stack.push(nb);
        }
      }

      const neighborCounts = new Map<number, number>();
      for (const i of pixels) {
        const x = i % width;
        const y = Math.floor(i / width);
        const neighbors = [
          x > 0 ? i - 1 : -1,
          x < width - 1 ? i + 1 : -1,
          y > 0 ? i - width : -1,
          y < height - 1 ? i + width : -1,
        ];
        for (const nb of neighbors) {
          if (nb < 0) continue;
          const v = result[nb] as number;
          if (v === levelValue || v === -1) continue; // border-majority against any differing neighbor, resolved or not
          neighborCounts.set(v, (neighborCounts.get(v) ?? 0) + 1);
        }
      }
      if (neighborCounts.size === 0) continue; // no differing neighbor at all yet -- try again next round
      let bestValue = levelValue;
      let bestCount = -1;
      for (const [value, count] of neighborCounts) {
        if (count > bestCount) {
          bestCount = count;
          bestValue = value;
        }
      }
      for (const i of pixels) {
        result[i] = bestValue;
        visited[i] = 1;
      }
      changed = true;
    }
  }

  return result;
}

export interface SmallRegionWarning {
  componentId: number;
  levelValue: number;
  sizePx: number;
}

/** After cleanup, report any remaining regions below the threshold (e.g.
 * isolated single-pixel-wide slivers with no reassignable neighbor) so the
 * UI can warn "may be difficult to punch reliably" per the product spec. */
export function findSmallRegions(
  index: Int16Array,
  width: number,
  height: number,
  minSizePx: number,
): SmallRegionWarning[] {
  const components = findConnectedComponents(index, width, height);
  return components
    .filter((c) => c.pixels.length < minSizePx)
    .map((c) => ({ componentId: c.id, levelValue: c.levelValue, sizePx: c.pixels.length }));
}
