# Architecture

## Layers

`src/domain/**` -- pure TypeScript. No React, no Three.js, no DOM APIs (the
one exception, `Web Worker` message passing, is a thin shell around domain
calls, not domain logic itself). Every function is a plain input->output
transform over typed arrays or plain objects, which is what makes the whole
processing pipeline unit-testable without a browser. Submodules:
`units.ts`/`types.ts`/`random.ts` (shared primitives), `relief.ts` (mask,
normalize, invert, intensity, smooth), `quantize.ts` (equal-interval and
quantile banding), `regionCleanup.ts` (connected components, tiny-region
reassignment), `regionId.ts` (C{n}-H{n} identity + symbols, 12 distinct symbol words as of
Iteration 02 Stage B to match the widened 2-12 height-level range),
`calibration.ts` (profile CRUD helpers, including the Stage B
`addNeedleSetting`/`removeNeedleSetting` pure functions --
`CalibrationEditor.tsx` calls these rather than mutating the settings array
inline, per the component/domain boundary below) /`calibrationStrip.ts`
(as of Iteration 03 Round 1, neither has any render-tree caller -- see
"Calibration UI removal" below -- but both, and their tests, are
untouched and still fully unit-testable), `color/colorQuantize.ts`
(Lab-space deterministic clustering), `color/colorMode.ts`,
`color/palettes.ts` (Iteration 03 Round 1: bundled named color-story
palette data + `applyPaletteToSwatches`, no network calls), `pattern/
legend.ts`, `pattern/yarnEstimate.ts`, `pattern/punchOrder.ts`, `pattern/
punchGuide.ts` (Iteration 02 Stage C: punch-guide dot-grid geometry -- the
first place a user-entered _physical_ measurement, dot spacing in cm, is
converted to raster pixels, via `units.ts`'s `cm`/`cmToPx`, never a bare
multiplication), `pattern/minRegionPreset.ts` (Iteration 03 Round 1: maps
the "Smallest punchable region" preset to a raster-area percentage,
deliberately _not_ a physical-unit conversion -- see `docs/DECISIONS.md`
for why this one differs from the punch-guide precedent above),
`projectSchema.ts`, `filenameSanitize.ts`, `import/validation.ts`,
`samples/*` (the 3 built-in fixtures, as plain mesh data).

`src/three/**` -- everything that touches a WebGL context or Three.js
types: `depthCapture.ts` (render-to-texture depth/color readback --
respects whatever transform is currently on the captured mesh, including
the Iteration 03 Round 1 model-straightening rotation below, with no
changes needed of its own), `viewport.ts` (camera fit/center/standard-view
math, kept numeric so most of it is still testable), `buildReliefMesh.ts`
(simulation geometry from a processed `RegionMap`; as of Iteration 03
Round 1 also takes an optional `LegendEntry[]` and writes a per-vertex
color attribute from it, and excludes background pixels from the index
buffer entirely instead of rendering them as a solid slab -- see
`docs/DECISIONS.md`), `sampleAdapter.ts` (converts domain `MeshData` to
`THREE.BufferGeometry`). `src/domain/import/{stlLoader,objLoader}.ts` also
live partly here conceptually (they wrap Three.js loaders) but are kept
under `domain/import` because their _contract_ -- validated file in,
geometry or a typed error out -- is what the rest of the app depends on.

`src/workers/processing.worker.ts` -- the only place the height/color
pipeline actually runs. Contains no algorithmic logic itself, only wiring:
receive a message, call `src/domain` functions in sequence, post the
result back. This keeps expensive per-pixel work off the main thread.

`src/components/**` -- React. Stage components under `components/stages/`
correspond 1:1 to the 5 workflow stages (down from 7 as of Iteration 02
Stage A -- see docs/ITERATION_02_PLAN.md: model orientation now happens on
Import once a model has loaded rather than a separate Orient stage, and
export/print actions live in a compact `ExportPanel`
(`src/components/ExportPanel.tsx`, outside `components/stages/` since it is
no longer a workflow stage) rendered inside Preview rather than a separate
Export stage). Components read state via props and call
`src/domain`/`src/three`/`src/export` functions; per CLAUDE.md, no
quantization/scaling/calibration math is allowed inline in a component. As
of Iteration 02 Stage B, `ReliefStage.tsx`'s controls are grouped into
Basic/Advanced tiers (see `docs/ITERATION_02_PLAN.md` §5) and the Relief
stage's 3D viewport is pinned in a sticky right-hand column via a
`className` toggle on `App.tsx`'s `<main>` and the viewport's wrapper
`<div>` -- deliberately _not_ a new conditional wrapper element, so the
shared `Viewport3D` instance's mount identity across Import<->Relief
navigation (guarded by `e2e/orient-persistence.spec.ts`) is unaffected; see
`docs/DECISIONS.md` for the reasoning. `Viewport3D.tsx` also gained
model-straightening rotation controls in Iteration 03 Round 1 (Roll/Pitch/
Yaw sliders, rotating the mesh `Object3D` itself), implemented as local
component state that rides the same never-remounted-instance guarantee
the existing camera-view state already relies on -- no new props, no
`AppState` changes; see `docs/DECISIONS.md`.

**Calibration UI removal (Iteration 03 Round 1).** `HeightStage.tsx` no
longer has a "Calibrate needle settings" link (or any needle-setting
column); `Legend.tsx` no longer has needle-setting/measured-height
columns; `ExportPanel.tsx` no longer renders a Calibration section
(`CalibrationEditor.tsx` usage removed) and no longer takes
`calibrationProfile`/`savedProfiles`/`onCalibration*`/`focusCalibration`
props. This is a render-tree-only removal, by explicit reversible product
decision -- `src/domain/calibration.ts`, `CalibrationEditor.tsx`, and
their tests are untouched, and `AppState.calibrationProfile`/
`savedProfiles` and their reducer actions stay wired in `App.tsx`/
`state/appState.ts` (feeding `buildLegend`/`SimulationView`'s height
lookup, and the `localStorage`-load mount effect, respectively). See
`docs/DECISIONS.md` for the exact kept/removed inventory.

As of Iteration 02 Stage C, `PreviewStage.tsx` also owns the on-screen
"Region labels" toggle and the "Punch guide" selector/spacing controls,
reading/writing a new `patternViewSettings` slice of `AppState`
(`src/state/appState.ts`). As of Iteration 03 Round 1, `PreviewStage.tsx`
forwards its on-screen `view`/`showGrid`/`mirrored` state (local
`useState`, not lifted to `AppState`) plus `patternViewSettings`'s
`showOnScreenLabels`/`punchGuide` down to `ExportPanel.tsx` as
`screenView`/`screenShowGrid`/`screenMirrored`/`screenShowLabels`/
`punchGuide` props, which `ExportPanel.tsx` now reads directly for every
export/print SVG build -- reversing the Stage C decision that let
`ExportPanel`'s own independent view-selector/label-checkbox diverge from
what's on screen (`ExportPanel` no longer has those controls at all). See
`docs/DECISIONS.md`. `usePatternSvgUrl.ts` (`src/hooks/`) was refactored
from six positional primitive args to a single `SvgPatternOptions` object,
to avoid making an already-long positional call signature worse when the
`punchGuide` option was added.

`src/state/**` -- two plain reducers, framework-light enough to unit test
without React: `workflow.ts` (which stage is active, gating, and the
"never lose settings when navigating" rule) and `appState.ts` (all domain
settings and the current processed result).

`src/export/**` -- `svgPattern.ts` (compose the pattern SVG from a
`RegionMap` + `LegendEntry[]`), `printTiling.ts` (pure page-tiling math),
`download.ts` (blob/file download + SVG->PNG rasterization),
`calibrationExport.ts`.

`src/persistence/**` -- `calibrationStore.ts` (localStorage CRUD with
quota-error handling) and `projectStore.ts` (project JSON
serialize/deserialize on top of `domain/projectSchema.ts`).

## Data flow (relief pipeline)

`Viewport3D` (live Three.js scene) --`captureDepth()`--> raw depth/color
buffers --`postMessage`--> `processing.worker.ts` --domain functions in
sequence (mask -> normalize -> invert -> intensity -> smooth -> quantize ->
cleanup [-> color quantize -> cleanup])--> `RegionMap` --`postMessage`
back--> `App.tsx` state --> `PatternCanvas` / `SimulationView` /
`Legend`, all rendering from the _same_ `RegionMap` + `LegendEntry[]`, so
the pattern, the simulation, and the legend can never disagree with each
other about what a region is.

## Why no React Three Fiber

The 3D surface area here is small and mostly imperative (one viewport
scene, one simulation scene, both with a fixed set of objects updated on
prop changes) -- a raw `useEffect`-managed `THREE.Scene` is simpler to
reason about than mapping that onto R3F's declarative reconciler, and it
avoids an extra dependency. See docs/DECISIONS.md.

## Units discipline

See CLAUDE.md. Canonical branded types live in `src/domain/units.ts`; every
function that crosses a pixel/cm/inch/model-unit boundary takes and returns
one of those types, and conversions are named functions, never bare
multiplication at the call site.
