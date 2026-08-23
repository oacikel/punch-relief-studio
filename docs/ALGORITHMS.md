# Algorithms

## Depth capture

The selected orthographic camera renders the mesh with an override
`ShaderMaterial` that writes camera-space linear depth (remapped to [0,1]
between `camera.near`/`camera.far`) into the color channel of a float
render target. A pixel with alpha 0 after the pass never received a
fragment -- that's the background/foreground mask, for free, from the
GPU's own depth test (which already guarantees the _nearest_ fragment wins
per pixel, so occluded back-surfaces can never leak through). See
`src/three/depthCapture.ts`.

## Relief processing (`src/domain/relief.ts`)

1. **Foreground mask** -- `buildForegroundMask`: any pixel where the raw
   depth capture isn't the empty sentinel and is finite.
2. **Normalize** -- `normalizeDepth`: min/max computed _only_ over
   foreground pixels (so background never skews the range), mapped so
   nearer-to-camera (smaller raw depth) becomes closer to 1.0.
3. **Invert** -- `invertRelief`: optional `1 - v` flip for near-to-low
   framing.
4. **Intensity** -- `applyIntensity`: scales deviation from the
   foreground mean by `intensity` in [0,1]; `intensity=0` flattens to a
   uniform mean height, `intensity=1` is untouched.
5. **Smooth** -- `smoothRelief`: a box blur blended with the original
   value per-pixel, where the blend weight drops near strong local
   gradients (approximate edge preservation -- not a true bilateral
   filter, which would cost meaningfully more at this resolution for
   marginal visual gain; documented trade-off, see DECISIONS.md).

## Quantization (`src/domain/quantize.ts`)

Two deterministic modes, both producing `HeightLevel[]` with monotonic,
non-overlapping `[lowerBound, upperBound)` bands (the last band's upper
bound is inclusive of 1.0):

- **Equal-interval**: fixed-width bands, `1/levels` each.
- **Quantile**: bands computed from a **sorted copy** of foreground values
  so each band gets an equal pixel count; sorting a fixed input array in a
  fixed order is deterministic, so repeat runs are bit-identical. Degenerate
  (all-equal-value) input is guarded against collapsing bounds via
  `dedupeMonotonic`.

Boundary rule (`levelIndexForValue`): a value on an interior boundary
belongs to the _upper_ band; the very top value (1.0) belongs to the
highest band even with floating-point rounding.

## Region cleanup (`src/domain/regionCleanup.ts`)

4-connected flood-fill labeling (`findConnectedComponents`), scanned
row-major so component IDs and visit order are stable across runs.
`cleanupTinyRegions` repeatedly (bounded to 20 passes) reassigns
below-threshold components to whichever neighboring component value
borders the most of their pixels; components with no non-background
neighbor are left alone (no data loss) and reported by `findSmallRegions`
so the UI can warn the user rather than silently deleting geometry.

## Needle-geometry width constraint (`src/domain/pattern/needleGeometry.ts`)

Optional, off by default (`diameterMm`/`throwMm` both `0`). When a user
enters real needle diameter and throw (mm), each pile-height level gets a
derived loop height (linear interpolation between `diameterMm`, the
shortest possible loop, and `throwMm * 0.5`, the "practically usable"
tallest loop) and a minimum region width driven by that loop height's
_ratio_ to the diameter -- `MIN_WIDTH_MULTIPLIER_SHORT` (~1.4x) at ratio 1
(loop height equals the diameter, the physical floor), linearly down to
`MIN_WIDTH_MULTIPLIER_TALL` (~1x) once the ratio reaches
`LOOP_HEIGHT_RATIO_CAP` (2.5) -- a shorter loop needs a proportionally wider
region to read as a clean punched shape, and this single number is
deliberately the only compensation surfaced anywhere (no separate
"double-pass" indicator; see `docs/ITERATION_04_PLAN.md` §1 for why).
Ratio-based rather than level-index-based on purpose: an earlier version
derived the multiplier from the same level-index fraction the loop-height
interpolation itself uses, which made `throwMm`'s actual magnitude cancel
out of the result -- see `docs/DECISIONS.md`'s "Needle-width multiplier:
ratio-based, not level-index-based" for the bug and the real-needle-spec
trace that found it.

Converted to a pixel width (`minWidthPxForLevel`) via the pattern's
physical `widthCm`/`heightCm` and enforced in `processing.worker.ts`, after
the existing `minRegionPreset` cleanup pass, by `applyNeedleWidthOpening`
(`src/domain/regionCleanup.ts`) -- shapes `heightIndex` directly during
generation, not a post-hoc warning. This is a genuine local-thickness
check (a per-level morphological opening: erode each level's mask by
roughly half the minimum width via a Chebyshev distance transform, dilate
the survivors back out, then multi-source-BFS-reassign whatever didn't
survive to whichever kept pixel -- any level -- is nearest), not a
whole-region pixel-_area_ check -- deliberately replacing an earlier
area-based version (`minWidthAreaPxForLevel`/`cleanupTinyRegionsByLevel`)
that could pass a region with a thin neck or spike as long as its _total_
area cleared the bar. See `docs/DECISIONS.md`'s "Needle-width floor: from
area check to local-thickness opening" for the full account, and
`docs/LIMITATIONS.md` for the approximations this version still carries
(Chebyshev, not Euclidean, distance).

## Color quantization (`src/domain/color/colorQuantize.ts`)

sRGB -> linear -> CIE XYZ (D65) -> CIE Lab, a standard perceptually-uniform
space. Clustering is k-means-style: **farthest-point seeding** (first
centroid picked by the app's fixed-seed `Rng`, each subsequent centroid the
foreground point farthest in Lab-distance from all chosen centroids so far)
followed by up to 20 Lloyd's-algorithm iterations (assign -> recompute
centroid means -> repeat until no assignment changes). Determinism comes
from: a fixed-seed xorshift32 PRNG (`src/domain/random.ts`) instead of
`Math.random()`, and iterating pixels in a fixed row-major order.

## Calibration (`src/domain/calibration.ts`)

A profile's needle settings are user-entered; `mapHeightLevelToSetting`
distributes N generated height levels across M needle settings by linear
interpolation of index ratios (`round(ratio * (M-1))`), so level count and
setting count don't have to match. A profile is "calibrated" the moment
_any_ setting has a non-null measured height; until then, every needle
setting shown anywhere in the UI is labeled "uncalibrated" rather than
implying a real millimetre value (product constraint, see CLAUDE.md).

## Yarn-usage estimate (`src/domain/pattern/yarnEstimate.ts`)

`meters = areaCm2 * loopsPerCm^2 * (2 * pileHeightCm) / 100`. Assumes a
fixed loop density (default 2.5 loops/cm in both directions) and that each
loop consumes twice the pile height in yarn (up and back through the
fabric). Falls back to a placeholder pile height when the profile is
uncalibrated, and always returns the assumption list alongside the number
so it can never be shown as a bare, unqualified figure.

## Print scaling (`src/export/printTiling.ts`)

Pure math, no PDF library: given a pattern's physical width/height, a page
size (A4/Letter/actual), overlap, and margin, computes the row/column grid
and each tile's `[x0,y0,x1,y1]` region in centimetres. Single-page fast
path when the pattern already fits. The PDF itself is produced via the
browser's native print pipeline (`window.print()` against a
print-stylesheet), not a bundled PDF library -- see DECISIONS.md.
`ExportStage` renders one `.print-page` per tile (hidden on screen, shown
only via `@media print`), each clipping a full-size copy of the pattern
image to that tile's region with a negative CSS offset so every page
prints at true physical scale (`cmToCssPx`, 96dpi), with a page break
between tiles and corner crop marks for cutting/aligning overlaps by hand.
