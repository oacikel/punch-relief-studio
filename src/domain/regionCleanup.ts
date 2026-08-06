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
