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
`pattern/labelPlacement.ts` (Iteration 03 Round 2: pure, deterministic
region-label collision avoidance -- sorts candidates by area, nudges a
colliding label through a small fixed ring search before dropping it
entirely; see `docs/DECISIONS.md`), `projectSchema.ts`,
`filenameSanitize.ts`, `import/validation.ts`, `samples/*` (the 3
built-in fixtures, as plain mesh data).

`src/three/**` -- everything that touches a WebGL context or Three.js
types: `depthCapture.ts` (render-to-texture depth/color readback --
respects whatever transform is currently on the captured mesh, including
the Iteration 03 Round 1 model-straightening rotation below, with no
changes needed of its own), `viewport.ts` (camera fit/center/standard-view
math, kept numeric so most of it is still testable; Iteration 03 Round 2
adds `projectedHalfExtent`/`fitOrthographicCameraToExtent`, framing the
camera to the geometry's real 2D-projected extent for whatever direction
it's currently facing, instead of an isotropic bounding-sphere radius --
see `docs/DECISIONS.md`), `buildReliefMesh.ts` (simulation geometry from a
processed `RegionMap`; as of Iteration 03 Round 1 also takes an optional
`LegendEntry[]` and writes a per-vertex color attribute from it, and
excludes background pixels from the index buffer entirely instead of
rendering them as a solid slab -- see `docs/DECISIONS.md`),
`sampleAdapter.ts` (converts domain `MeshData` to `THREE.BufferGeometry`).
`src/domain/import/{stlLoader,objLoader}.ts` also live partly here
conceptually (they wrap Three.js loaders) but are kept under
`domain/import` because their _contract_ -- validated file in, geometry or
a typed error out -- is what the rest of the app depends on.

`src/workers/processing.worker.ts` -- the only place the height/color
pipeline actually runs. Contains no algorithmic logic itself, only wiring:
receive a message, call `src/domain` functions in sequence, post the
result back. This keeps expensive per-pixel work off the main thread.

`src/components/**` -- React. As of Iteration 03's combined-workspace
change (`docs/ITERATION_03_PLAN.md` #13, down from 5 workflow stages,
which had themselves been down from 7 as of Iteration 02 Stage A), there
are just **2** workflow stages: `components/stages/ImportStage.tsx`
(unchanged in spirit -- model selection/import, plus, once loaded, the
orientation section) and a single persistent **Workspace**, whose
components live under `src/components/workspace/`:

- `Workspace.tsx` -- the stage's top-level container. Renders the control
  rail (left) and sticky preview column (right) as two grid-column
  siblings inside `App.tsx`'s `<main className="workspace-layout">`
  (renamed from `relief-layout`, same sticky mechanism -- see
  `docs/DECISIONS.md`). Owns `view`/`showGrid`/`mirrored` as local
  `useState` (moved up from the former `PreviewStage.tsx`) since both
  `PatternPanel` and `ExportPanel` -- now rail siblings, not parent/child
  -- need them as controlled props from one shared owner. Gates
  `PatternPanel`/`SimulationPanel`/`ExportPanel` on `regionMap && processed`
  being non-null (a rail placeholder shows in the interim, before the
  first live generation has landed), while the rest of the rail
  (`ReliefControls`/`YarnColorsGroup`) stays always-interactive.
- `ReliefControls.tsx` -- the former `ReliefStage.tsx`'s three groups
  (Needle & pile / Punch detail / Shape interpretation) verbatim, minus
  the manual "Generate relief" button (replaced by live regeneration --
  see `src/hooks/useLiveRelief.ts` below), plus the former
  `HeightStage.tsx`'s per-level coverage table (now a live chip row under
  "Needle & pile") and small-region warning (moved under "Punch detail" --
  see `docs/DECISIONS.md` for the placement reasoning).
- `YarnColorsGroup.tsx` -- the former `ColorStage.tsx`'s content verbatim,
  rendered as a rail `<div className="control-group">` instead of its own
  page.
- `PatternPanel.tsx` / `SimulationPanel.tsx` -- the former
  `PreviewStage.tsx`'s two columns, extracted into the sticky preview
  column's two stacked panels. `SimulationPanel.tsx` additionally renders
  `<RotationControls>` (see below).
- `ExportPanel.tsx` (unchanged, stays at the top level of
  `src/components/**`, not under `workspace/`) -- the existing compact
  export/print panel, simply relocated into the rail as one more collapsed
  `<details>` section.

Components read state via props and call `src/domain`/`src/three`/
`src/export` functions; per CLAUDE.md, no quantization/scaling/calibration
math is allowed inline in a component.

**Model-straightening rotation (Iteration 03 Round 1, relocated in the
combined-workspace change).** `Viewport3D.tsx`'s Roll/Pitch/Yaw controls
used to be local component state; they're now controlled via
`rotationDeg`/`onRotationChange` props reading/writing
`AppState.modelRotationDeg`, so both `Viewport3D` (Import) and
`SimulationPanel.tsx` (Workspace) can render the same
`src/components/RotationControls.tsx` (new, purely presentational, shared)
against one value. `Viewport3D.tsx` also gained a `showControls` prop
(true only on Import) so its own standard-view buttons/rotation sliders
don't render at all while `SimulationPanel`'s copy is the active one --
see `docs/DECISIONS.md` for the full reasoning, including why `Viewport3D`
still stays mounted (just visually hidden) throughout Workspace.

**Live regeneration (`src/hooks/useLiveRelief.ts`, new).** Replaces the
former manual "Generate relief" button (`App.tsx`'s old
`handleGenerateRelief`) with a debounced (300ms) pipeline, gated on
relief-generation-affecting settings only (`ReliefSettings` fields +
`modelRotationDeg`), using a monotonic generation counter to discard a
slower, superseded in-flight worker result rather than let it overwrite a
newer one. Pure orchestration -- `capture`/`process`/`buildProcessArgs`
are injected functions, so the hook has zero direct Three.js/Worker
coupling and is unit-testable with mocks (see
`src/hooks/__tests__/useLiveRelief.test.ts`). See `docs/DECISIONS.md` for
the debounce-interval profiling and the full algorithm.

The sticky-preview mechanism itself (Iteration 02 Stage B: rail scrolls,
preview column pinned via `position: sticky`) is unchanged, just renamed
(`relief-layout`/`relief-controls-col`/`relief-preview-col` ->
`workspace-layout`/`workspace-controls-col`/`workspace-preview-col`) --
see `docs/DECISIONS.md`. The shared `Viewport3D` instance's never-
remounted guarantee (guarded by `e2e/orient-persistence.spec.ts`) now
spans Import<->Workspace instead of Import<->Relief, for the same reason
as before: `capture()` depends on that live WebGL scene staying alive.

**Calibration UI removal (Iteration 03 Round 1).** The former
`HeightStage.tsx` (now `ReliefControls.tsx`'s live chip row) has no
needle-setting column or "Calibrate needle settings" link; `Legend.tsx`
has no needle-setting/measured-height columns; `ExportPanel.tsx` renders
no Calibration section (`CalibrationEditor.tsx` usage removed) and takes
no `calibrationProfile`/`savedProfiles`/`onCalibration*`/`focusCalibration`
props. This is a render-tree-only removal, by explicit reversible product
decision -- `src/domain/calibration.ts`, `CalibrationEditor.tsx`, and
their tests are untouched, and `AppState.calibrationProfile`/
`savedProfiles` and their reducer actions stay wired in `App.tsx`/
`state/appState.ts` (feeding `buildLegend`/`SimulationView`'s height
lookup, and the `localStorage`-load mount effect, respectively). See
`docs/DECISIONS.md` for the exact kept/removed inventory.

As of Iteration 02 Stage C, the on-screen "Region labels" toggle and
"Punch guide" selector/spacing controls (now on `PatternPanel.tsx`) read/
write a `patternViewSettings` slice of `AppState` (`src/state/appState.ts`).
As of Iteration 03 Round 1, `ExportPanel.tsx` reads
`screenView`/`screenShowGrid`/`screenMirrored`/`screenShowLabels` props
(supplied by `Workspace.tsx`, see above) directly for every export/print
SVG build -- reversing the Stage C decision that let `ExportPanel`'s own
independent view-selector/label-checkbox diverge from what's on screen.
See `docs/DECISIONS.md`. `usePatternSvgUrl.ts` (`src/hooks/`) takes a
single `SvgPatternOptions` object rather than positional primitive args.

`src/state/**` -- two plain reducers, framework-light enough to unit test
without React: `workflow.ts` (which of the 2 stages is active, gating, and
the "never lose settings when navigating" rule) and `appState.ts` (all
domain settings, including `modelRotationDeg`, and the current processed
result).

`src/hooks/**` -- React hooks that wire domain/worker functions into
components without containing domain logic themselves: `useProcessingWorker.ts`
(Web Worker message-passing), `useLiveRelief.ts` (debounced live
regeneration, see above), `usePatternSvgUrl.ts` (SVG pattern build +
blob-URL lifecycle for `PatternCanvas`/`ExportPanel`).

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
