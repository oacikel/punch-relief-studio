# Decisions

Format: decision, alternatives considered, why.

## No React Three Fiber

**Decision:** vanilla Three.js in `useEffect`-managed components.
**Alternative:** R3F for declarative scene graphs.
**Why:** the app has exactly two Three.js scenes (viewport, simulation),
each with a small, mostly-static set of objects. R3F's value is managing
_many_ dynamic objects declaratively; here it would add a dependency
without simplifying anything (decision rule: prefer the simplest
architecture that satisfies the acceptance criteria).

## No bundled PDF library for print export

**Decision:** `window.print()` against a print stylesheet, with page-tiling
math (`printTiling.ts`) implemented and unit tested independently of the
browser print pipeline.
**Alternative:** jsPDF, pdf-lib, or similar.
**Why:** a PDF library is a meaningfully sized dependency for output the
browser can already produce natively, and native print respects the user's
own printer/page setup. **Trade-off accepted:** multi-page tiling still
goes through the browser's own print pipeline rather than a purpose-built
PDF layout engine, so page-size handling, margins, and exact crop-mark
placement are ultimately at the mercy of the browser/OS print dialog (users
are told to verify the printed scale-check square with a ruler before
cutting fabric, since some printers silently rescale to "fit page"
regardless of what the app renders).

## No schema-validation library for project JSON

**Decision:** hand-written structural checks in `projectSchema.ts`.
**Alternative:** zod, ajv, io-ts.
**Why:** the schema is a single, small, versioned interface; a
runtime-validation library is justified once the schema grows nested
polymorphic variants, which it doesn't yet.

## Local-only asset resolution for OBJ/MTL

**Decision:** `THREE.LoadingManager.setURLModifier` restricted to a
`filename -> blob:` map built from exactly the files the user dropped;
throws `RemoteAssetBlockedError` for anything else (absolute URLs,
unmatched filenames). See `src/domain/import/objLoader.ts`.
**Alternative:** trust Three.js's default manager and rely on browser CORS
to prevent remote fetches.
**Why:** CORS failures are not the same as "never attempted" -- a default
manager still _tries_ to fetch, which is both a privacy leak (reveals the
user's IP/activity to a third party referenced in someone else's file) and
against the product's local-only privacy requirement. Raised as a blocking
issue in the plan review (docs/PLAN_REVIEW.md) and resolved this way before
implementation.

## Worker-based processing

**Decision:** the height pipeline _and_ color quantization both run inside
`processing.worker.ts`, off the main thread.
**Alternative:** run color quantization on the main thread since it's
triggered less often.
**Why:** k-means-style clustering over image pixels is exactly the kind of
CPU-bound work that would jank the main thread on a larger palette/image;
raised in plan review, resolved by moving both into the same worker.

## Deterministic pseudo-randomness

**Decision:** one fixed-seed xorshift32 PRNG (`src/domain/random.ts`),
threaded explicitly through every function that needs it (farthest-point
color seeding). Never `Math.random()` anywhere in `src/domain`.
**Why:** the product requires the same input + settings to always produce
the same output.

## MIT license

**Decision:** MIT, a conservative, widely-understood permissive license,
per the product brief's "conservative standard open-source choice".

## Height-levels bound widened to 2-12 (Iteration 02 Stage B)

**Decision:** widen the number of discrete pile-height levels a pattern can
use from 3-8 to 2-12, enforced in `quantize()`'s `RangeError`
(`src/domain/quantize.ts`), the Relief-stage slider (`src/components/
stages/ReliefStage.tsx`), and mirrored by the new needle-setting count
bounds `MIN_NEEDLE_SETTINGS`/`MAX_NEEDLE_SETTINGS` (1-12,
`src/domain/calibration.ts`).
**Alternatives considered:** a narrower ceiling (e.g. 2-10) that would
track the old default profile's 4 settings less generously; an unbounded
upper limit.
**Why 2, not 1 or 3:** 1 level is degenerate -- a single "flat" band isn't
a punch-needle relief pattern at all, so 2 is the real floor for the
feature to mean anything. The old floor of 3 had no principled
justification found in the original spec/decisions; nothing breaks with
2, confirmed by the widened unit test in `quantize.test.ts`.
**Why 12, not 8 or 16:** 12 is a practical ceiling tied to needle-setting
realism rather than an arbitrary round number -- most adjustable
punch needles have somewhere in the 6-12 discrete setting range, and this
same release adds real add/remove UI to `CalibrationProfile.settings`
(also capped at 12, see the next decision below) so the two bounds move
together by construction instead of one silently exceeding the other. A
higher ceiling would let a pattern specify more distinct heights than any
real calibration profile could ever have distinct needle settings for,
which contradicts the product's own "never claim more precision than the
hardware/measurement supports" stance.
**Schema/migration note:** `ProjectFile.reliefSettings.levels`
(`src/domain/projectSchema.ts`) embeds this number directly. Old project
JSON files with `levels` anywhere in the old 3-8 range remain valid under
the widened range -- this is purely additive (a widened _allowed_ range,
not a shape change), so no `PROJECT_SCHEMA_VERSION` bump was needed.
`parseProjectFile`'s structural validation never checked the numeric bound
in the first place (only `quantize()` and the UI did), so there was
nothing to update there either.
**Related fixed-size arrays widened in lockstep:** two unrelated-looking
arrays were sized for the old 8-level ceiling and would have silently
degraded above it if left alone -- `HEIGHT_SYMBOLS`
(`src/domain/regionId.ts`, the on-screen legend's symbol-word column, was
8 entries) and `DEFAULT_PALETTE` (`src/state/appState.ts`, the default
"color by height" swatch colors, also 8 entries). Both are now 12 entries,
found and fixed following an independent plan review that specifically
flagged them as the kind of "hardcoded array sized for the old max" the
levels-bound change needed to check for.

## CalibrationProfile.settings: real add/remove UI, not a fixed 12-slot stub (Iteration 02 Stage B)

**Decision:** build real "Add needle setting"/"Remove" UI in
`CalibrationEditor.tsx`, backed by pure `addNeedleSetting`/
`removeNeedleSetting` functions in `src/domain/calibration.ts` (1-12
settings per profile), rather than shipping a fixed 12-slot profile with
unused entries labeled "not yet measured".
**Alternatives considered:** (a) a fixed 12-slot profile, always showing
12 rows regardless of how many settings the user's needle actually has;
(b) leaving `CalibrationEditor` as edit-in-place only (its pre-Stage-B
state) and just widening the level bound, accepting that
`mapHeightLevelToSetting` would keep distributing many levels onto few
settings for anyone who didn't hand-edit a JSON profile.
**Why real add/remove UI:** most adjustable punch needles have far fewer
than 12 real settings, so a fixed 12-slot profile would force every user
toward padding they didn't ask for -- CLAUDE.md's "never label an
uncalibrated level with a fake value" principle argues against manufacturing
unused rows just as much as it argues against fake millimetre values.
`docs/ITERATION_02_PLAN.md` §10 had already diagnosed this as "a real UI +
validation gap, not just a bound change" before Stage B started, which is
what tipped the decision toward building it now rather than deferring
again.
**Why this was cheap to do:** the domain layer already handled a variable
setting count with no changes needed -- `mapHeightLevelToSetting`
distributes N height levels across whatever `profile.settings.length` is
via a ratio calculation (no hardcoded assumption of 4), and
`generateCalibrationStrip` (`src/domain/calibrationStrip.ts`) already
scales its SVG width by `settings.length`. The actual gap was UI-only,
exactly as §10 diagnosed. `settingNumber` is treated as a stable
identifier, not a contiguous index -- removing setting 2 from a profile
numbered 1-4 leaves 1, 3, 4, and adding afterward numbers the new entry
one past the current highest (5, not the gap at 2). Nothing downstream
(`legend.ts`, `calibrationStrip.ts`, `calibrationExport.ts`) assumes
contiguity, only uniqueness and sort order by number.

## Contextual calibration entry point stays inside Preview, not a new Settings surface (Iteration 02 Stage B)

**Decision:** calibration continues to live inside Preview's compact
"Export & print" panel (as Stage A left it). The Height Levels stage gets
a second, contextual entry point instead -- a "Calibrate needle settings"
link/button (`src/components/stages/HeightStage.tsx`) that navigates to
Preview and flags `ExportPanel.tsx` (via `focusCalibration`/
`onCalibrationFocused` props threaded through `PreviewStage.tsx`) to force
its disclosure open and scroll/focus to the calibration section. No new
global "Settings" route, nav item, or modal was built.
**Alternatives considered:** promoting calibration to a real Settings
surface reachable from anywhere in the app, independent of the 5-stage
workflow.
**Why not a global Settings surface (yet):** the app has no routing/URL
concept and no navigation surface outside the 5-item `WorkflowStage` enum
(`src/state/workflow.ts`). Adding a "Settings" destination that isn't a
workflow stage means either a 6th nav item (undercutting the "5 visible
stages" narrative Stage A just established, which this plan's own §5/§9
don't ask Stage B to revisit) or a non-stage overlay/modal, a UI pattern
this app has no precedent for anywhere else. `docs/ITERATION_02_PLAN.md`
§9's affected-modules table for Stage B lists "Heights (contextual
calibration link)" only, not a new Settings component/route, which matches
this reading of the scope as written. A contextual link that reuses
Preview's existing, already-tested `CalibrationEditor`/`ExportPanel` is
also simply lower-risk than standing up a second home for calibration in
the same session that's also widening the level/setting bounds.
**Left open, deliberately:** Preview (and therefore calibration) is gated
on `hasModel`, so a user can't reach calibration before loading a model
today. If user testing of this milestone shows people want to calibrate
before importing anything, a real global Settings surface remains open for
a later stage -- this decision is what ships now, not a foreclosure of
that option (§14 of `docs/ITERATION_02_PLAN.md` explicitly frames it as
revisitable: "may relocate it again").

## Sticky preview on the Relief stage: interpretation and implementation (Iteration 02 Stage B)

**Decision:** on desktop-width viewports, the Relief stage renders as a
two-column layout -- controls in a scrollable left column, the shared 3D
viewport pinned via CSS `position: sticky` in a right column -- so a user
adjusting a control partway down the (now longer, grouped) control list
can still see its effect without scrolling back to the top. Falls back to
normal single-column stacking below the same 720px breakpoint
`.app-shell` already uses to collapse its own layout (matches the
`mobile-narrow` e2e project's ~390px viewport, where a sticky side-by-side
layout wouldn't fit anyway).
**Why this needed an explicit interpretation:** `docs/ITERATION_02_PLAN.md`
mentions "sticky preview" exactly once, in the §8 milestone dependency-graph
one-liner, with no further detail -- the original product-owner request
message that would spell it out further is not included in this repository.
This is the interpretation Stage B implements, recorded here per the
project's own rule against silently guessing on a thin spec.
**Implementation, chosen specifically to protect an existing invariant:**
the shared `Viewport3D` instance must never remount when navigating between
Import and Relief (guarded by `e2e/orient-persistence.spec.ts` --
re-orienting on Import must survive the trip to Relief). The sticky layout
is implemented as a `className` toggle on `App.tsx`'s already-unconditional
`<main>` element and on the Viewport3D wrapper `<div>` (`stage-panel` vs.
`stage-panel relief-preview-col`), never as a new conditional wrapper
element introduced around `Viewport3D` itself. Both elements occupy the
same position in the JSX tree on every render regardless of which stage is
active, so React's positional reconciliation reuses the same fiber --
verified by the existing orientation-persistence e2e test still passing
unmodified in its assertions (only its already-updated label references
changed, in Stage A) and by a new e2e assertion in
`e2e/relief-workspace.spec.ts` that checks the computed CSS `position` of
`.relief-preview-col` is `sticky` at desktop width and `static` at
mobile-narrow width.

## Punch-guide/physical-spacing schema fields: optional field, no version bump (Iteration 02 Stage C)

**Decision:** `ProjectFile.exportSettings` (`src/domain/projectSchema.ts`)
gains a new, **optional** field, `punchGuide?: { mode: 'none' | 'dots';
spacingCm: number }`. `PROJECT_SCHEMA_VERSION` stays `1` -- no version bump,
no `migrateV1ToV2` function. `parseProjectFile`'s hand-written structural
validation is left completely unchanged: it already only checks _top-level_
key presence (`'exportSettings' in obj`, etc.) and has never deep-validated
`exportSettings`'s own shape, so an old (pre-Stage-C) project file simply
parses with `exportSettings.punchGuide` coming back `undefined`.
`App.tsx`'s `handleLoadProjectJson` supplies an explicit default at load
time (`project.exportSettings.punchGuide ?? { mode: 'none', spacingCm:
DEFAULT_PUNCH_GUIDE_SPACING_CM }`), covered by a unit test
(`projectSchema.test.ts`) that loads a fixture with no `punchGuide` key at
all and asserts it still parses.
**Alternatives considered:** bumping `PROJECT_SCHEMA_VERSION` to `2` and
writing a real `migrateV1ToV2` function that injects a default
`punchGuide` into any v1 file on load, per option (b) in
`docs/ITERATION_02_PLAN.md` §10.
**Why option (a), not (b):** `docs/ITERATION_02_PLAN.md` §10 explicitly
frames this as a live decision for Stage C to make on its own merits, not
by copying a precedent (the plan's own independent-review correction
notes that `ExportSettings.view`/`showLabels` were wrongly cited as
"additive, no version bump" precedent in an earlier draft, since those two
fields were never part of the persisted schema at all). Judged on its own
merits: a version bump plus migration function is the right tool for a
breaking or semantically ambiguous change -- neither is true here. The new
field is a single optional overlay setting with an obviously safe default
("no guide," never a fabricated spacing value), nested inside an object
`parseProjectFile` was already only shallow-validating. Writing migration
machinery, and updating every existing schema-version-`1` test fixture to
either carry the new field or exercise a migration path, would be real,
unrewarded complexity for a field that already degrades gracefully to
"absent means off." Reserve the version-bump mechanism (already built and
tested via `UnsupportedSchemaVersionError`) for a future change that
actually breaks old data or needs a genuine one-time transformation -- e.g.
a unit change, or restructuring an existing required field.
**Left open, deliberately:** `showOnScreenLabels` (the new independent
on-screen label toggle, see the design-interpretation entry below) is
**not** persisted in `ProjectFile` at all -- it lives only on
`AppState.patternViewSettings`, matching the existing precedent that
`ExportSettings.view`/`showLabels` are AppState-only display preferences,
never round-tripped through the schema. `punchGuide` is the one field of
`patternViewSettings` that _is_ persisted, specifically because
`docs/ITERATION_02_PLAN.md` §8 says Stage D (print/PDF reliability)
depends on the punch-guide setting existing and surviving a project
reload so a saved project can be reprinted correctly -- a pure display
preference like on-screen label visibility has no such downstream
dependency.

## Punch-guide design: a minimal, honestly-labeled dot-grid overlay (Iteration 02 Stage C)

**Decision:** the punch guide is a single overlay mode, "Dots" (plus
"None"), controlled by two Preview-stage controls -- a "Punch guide"
`<select>` (None/Dots) and a "Dot spacing (cm)" number input (0.2-5cm,
default 1cm, shown only when Dots is selected). The geometry is a plain
square grid of dots, spaced `spacingCm` real-world centimetres apart
across the _entire_ pattern canvas -- not clipped to the region
silhouette, not hex-packed, no separate "density" control distinct from
spacing. The same setting (`AppState.patternViewSettings.punchGuide`,
`src/state/appState.ts`) drives both the on-screen Preview pattern
(`PatternCanvas.tsx`) and every SVG/PNG/print export (`ExportPanel.tsx`)
-- one control, not duplicated per surface, so what a crafter sees in
Preview is exactly what prints.
**Why not more (region-clipping, hex packing, a separate density
divisor):** `docs/ITERATION_02_PLAN.md` describes this feature in exactly
one paraphrased line -- "punch-guide selector, physical dot spacing/
density" (§8/§9) -- with no source product-owner message in this
repository to check it against. Read literally: "selector" implies a
small enum (None/Dots satisfies it), and "spacing/density" are the same
quantity stated two ways (a smaller spacing _is_ a denser grid; a second,
independent "density" control would be redundant with spacing, not
additive). Region-silhouette clipping (only drawing dots inside actual
pattern pixels, via a flood-fill against `RegionMap.heightIndex === -1`
cells) was considered and explicitly rejected as unrequested scope --
the existing `showGrid` grid layer in `src/export/svgPattern.ts`
(`buildGrid`) already draws a full-canvas grid regardless of pattern
shape, so a full-canvas punch guide is consistent with that established
precedent, not a new inconsistency.
**Honesty framing:** CLAUDE.md requires never labeling an uncalibrated
height level with a fabricated millimetre value; the same standard is
extended here even though this is a different kind of physical
measurement (a value the _user_ chooses, not one the app infers). The
helper text under the controls states plainly: "This is the spacing you
set here, not a measurement of your printer's actual output -- always
check the printed scale-check square with a ruler before punching." No
claim is made that the dots correspond to any detected stitch density,
printer DPI, or needle tip size.
**Safety valve found in independent implementation review:** a large
physical pattern (e.g. 150cm x 150cm, a realistic punch-needle rug size)
at the minimum 0.2cm spacing would naively generate well over a million
`<circle>` elements, computed synchronously in the on-screen Preview's
render path -- a real UI-stall risk, not a hypothetical one. Rather than
crashing (throwing past a hard cap) or silently drawing a truncated,
misleading partial grid, `computePunchGuideDots`
(`src/domain/pattern/punchGuide.ts`) widens the _effective_ spacing just
enough to keep the total dot count at or under `MAX_PUNCH_GUIDE_DOTS`
(20,000) when the naive grid would exceed it -- spacing only ever widens,
never narrows, in this fallback, so an enforced dot is never closer to
its neighbors than the user actually asked for. Covered by a dedicated
unit test asserting the cap holds for a 150x150cm pattern at minimum
spacing, and a companion test asserting the cap is a complete no-op well
under the threshold.
**Left open, deliberately:** if user testing surfaces a real need for
region-aware clipping, denser placement near small/fiddly regions, or a
second guide mode (e.g. a triangular/hex grid), those remain open for a
later stage -- this is the smallest version that's honestly labeled and
actually useful, not a foreclosure of richer guides later.

## Sandbox network constraint's effect on this build

**Decision:** this MVP was built in a sandboxed session with no outbound
network access to npm or GitHub (confirmed via direct requests returning
HTTP 403 from the proxy) and a working directory mounted over FUSE that
does not support file deletion/rename (git requires this, so the actual
git repository was built on a local ext4 path and mirrored into the
mounted workspace folder for the user to inspect).
**Why documented here:** every "Deferred-verify" row in
docs/ACCEPTANCE_MATRIX.md and every unrun command in docs/TEST_REPORT.md
traces back to this one constraint, not to missing implementation effort.

## Iteration 03 Round 1

Implements docs/ITERATION_03_PLAN.md points #1, #2, #5, #6, #7, #8, #9,
#10, #11 (each point's own "RESOLVED"/"Status" note there links back
here). #3, #4, #13 stayed explicitly out of scope for this round.

### Background excluded from the finished-piece simulation mesh (#9)

**Decision:** `buildReliefGeometry` (`src/three/buildReliefMesh.ts`) still
computes a height (`y`) for every vertex including background ones (kept
at `y=0`, unchanged from before), but now filters the geometry's index
buffer after the fact, dropping any triangle that references a background
(`heightIndex === -1`) vertex. Background pixels become a real gap in the
mesh -- no triangles drawn there -- instead of a filled zero-height slab.
**Alternative considered:** rebuild the geometry from scratch as a sparse
mesh (only emit vertices/faces for foreground pixels), which would avoid
carrying unused background vertices in the position buffer.
**Why the index-filter approach instead:** it reuses `THREE.PlaneGeometry`
verbatim for vertex layout, UVs, and (post-filter) `computeVertexNormals`,
so the only new code is the filter loop and the per-vertex foreground
flag -- far less surface area to get wrong than a from-scratch sparse
mesh builder, at the cost of some unreferenced vertices sitting unused in
the position buffer (harmless: they're never drawn, and nothing here
calls `computeBoundingBox`/`computeBoundingSphere` on the result, since
camera framing in `SimulationView.tsx` uses `widthCm`/`heightCm` directly,
not geometry bounds).
**Known cosmetic edge case:** because a triangle survives only when _all
three_ of its vertices are foreground, the silhouette boundary erodes by
roughly half a grid cell all the way around (a triangle straddling the
foreground/background edge is dropped entirely, not clipped to the exact
boundary). At the hardcoded 256px capture resolution (see below) this is
imperceptible in practice; a true silhouette-clipped mesh (inserting new
boundary vertices at the exact fg/bg crossing) would be the fix if it
ever becomes visible, not attempted here as unrequested scope.
**Index typed-array size:** `geometry.setIndex()` is called with a plain
JS `number[]`, not a pre-sized typed array -- Three.js picks `Uint16Array`
vs `Uint32Array` itself based on the array's contents, so this stays
correct even if a legacy project JSON requests `outputResolutionPx` above
256 (see below), where a 512x512 capture's ~262k vertices would overflow
a naively-sized `Uint16Array`.

### Yarn color in the finished-piece simulation (#10)

**Decision:** `buildReliefGeometry` takes an optional `legend:
LegendEntry[]` and writes a per-vertex `color` `BufferAttribute`, looking
up each pixel's color via `regionId(colorIndex, heightIndex)` against a
`Map` built from the legend (the exact same ID format
`domain/pattern/legend.ts` produces and `export/svgPattern.ts`'s
`fillForView` already keys off of). `SimulationView`'s material switches
from a hardcoded `color: 0xb5563c` to `vertexColors: true, color:
0xffffff` (a white base so vertex colors render unmodified -- Three.js's
`MeshStandardMaterial` multiplies base color by vertex color).
**Alternative considered:** per-region sub-meshes/materials (one
`THREE.Mesh` per distinct region, each with its own solid-color
material), which would give perfectly crisp region boundaries instead of
the shaded-material's per-fragment color interpolation across a shared
vertex.
**Why per-vertex color instead:** the geometry is a single shared-vertex
displaced plane (see the background-exclusion decision above) --
splitting it into per-region sub-meshes would mean re-deriving mesh
topology per contiguous region (essentially the same connected-component
analysis `regionCleanup.ts` already does, just re-run for meshing instead
of cleanup) for a visual difference that's minor at this resolution.
Per-vertex color reuses the existing single-mesh structure with no new
topology code, at the cost of color blending slightly across region
boundaries -- consistent with (not a new inconsistency versus) the
existing per-vertex _height_ interpolation this same mesh already does,
which the file's own doc comment already describes as "stepped,
faceted-but-smoothed."
**One source of truth, not two:** deliberately reuses `LegendEntry[]`
(the same data `PatternCanvas`/`Legend.tsx`/`svgPattern.ts` already
render from) rather than recomputing color-by-mode logic a second time
inside `src/three/`. `src/three` importing this `src/domain/pattern`
type is within CLAUDE.md's architecture rule -- `three/` may talk to
`domain` via plain data, `LegendEntry` has zero React/Three imports, and
`buildReliefMesh.ts` already imported `CalibrationProfile`/`HeightLevel`/
`RegionMap` from `domain` before this change, so this isn't a new
architectural pattern.

### Lighting-slider camera reset fix -- effect split (#8)

**Decision:** `SimulationView.tsx`'s single mega-effect (which rebuilt
the entire scene -- renderer, camera, `OrbitControls`, mesh, lights,
everything -- on every prop change) is split into three: a mount effect
(deps `[]`, creates renderer/scene/camera/controls/lights/materials
exactly once), a geometry effect (deps: regionMap/levels/profile/
widthCm/heightCm/legend, rebuilds mesh+fabric geometry and re-frames the
camera), and a light/material effect (deps: pileStyle/fabricColorHex/
lightingAzimuthDeg/lightingElevationDeg **plus** widthCm/heightCm,
updates the light position and material properties in place, never
touches camera/controls).
**Why widthCm/heightCm are in the light effect's deps too, not just the
geometry effect's:** light _distance_ (not just direction) scales with
`Math.max(widthCm, heightCm)` (`maxSpan`) in the original formula. Without
this, changing the pattern's physical Width/Height without touching a
lighting slider would leave the light positioned for the old size -- the
same class of stale-effect bug this split exists to fix, just moved to a
different trigger. Since the light effect never touches camera/controls,
re-running it more often than strictly necessary is harmless.
**Accepted trade-off:** the geometry effect _does_ still re-frame the
camera (matching how `Viewport3D.tsx`'s own geometry effect already
re-fits its camera on new geometry) whenever regionMap/levels/profile/
dimensions change -- e.g. recoloring swatches on the Yarn Colors stage
changes `regionMap`, which resets the simulation's camera framing on the
next Preview visit. This is a real, narrower residual of the original
"camera resets on non-user-requested changes" complaint, but it's
strictly better than before (those changes were rare compared to
dragging a lighting slider, which is the specific interaction the bug
report was about) and matches the established `Viewport3D.tsx` precedent
rather than inventing a new one. Left open for a future pass if it proves
user-visible.

### "Smallest punchable region" presets, not physical units (#1)

**Decision:** `src/domain/pattern/minRegionPreset.ts` exports three named
presets (`fine`/`balanced`/`bold`), each mapped to a fixed percentage of
the raster canvas area: fine 0.01%, balanced 0.02%, bold 0.08%.
`minRegionPxForPreset(preset, width, height)` computes
`Math.max(1, Math.round(width * height * percent))`.
**Why not cm/mm (the original draft plan's proposal):** the control feeds
`cleanupTinyRegions` inside `processing.worker.ts`, which runs during
relief generation -- _before_ the app has ever asked for a physical
Width/Height (that's an Export-panel-only concept, set after the fact).
A cm-based value would have no scale to convert against at the point
it's actually applied; the only way to make it "work" would be assuming
a placeholder physical size, which would be a fabricated-precision
violation of CLAUDE.md's units discipline in spirit even if not in the
literal `Cm`/`Px` type sense.
**Why percentage-of-area instead of a fixed px count (the original
control's shape):** the removed "Detail resolution" control (see next
decision) is now hardcoded at 256px, so in practice the resolution is
fixed for new sessions -- but old project JSON can still carry a
different `outputResolutionPx`, and a percentage stays meaningful at any
resolution rather than silently becoming too aggressive/too lax if the
effective raster size ever changes.
**Why these specific percentages:** chosen so `balanced` at 256x256
(65,536px) rounds to 13px, close to the previous fixed default of 12px --
existing patterns generated with default settings look almost identical
under the new default preset, not surprisingly different. `fine`/`bold`
are roughly 4x smaller/larger than `balanced` (7px / 52px at 256x256),
giving three genuinely distinct results rather than three presets that
all look the same in practice. Locked in by
`src/domain/pattern/__tests__/minRegionPreset.test.ts`.
**Backward compatibility:** `ReliefSettings.minRegionPx: number` was
renamed outright to `minRegionPreset: MinRegionPreset` (a shape change,
unlike `outputResolutionPx` which keeps its old field -- see next
decision for why that one differs). A pre-Round-1 project JSON's stray
`minRegionPx` key is harmlessly absorbed as dead data by
`SET_RELIEF_SETTINGS`'s shallow-merge reducer, while a missing
`minRegionPreset` key simply leaves the existing default ('balanced') in
place -- no crash, no `NaN`, no schema-version bump needed (`ProjectFile.
reliefSettings: ReliefSettings` is a type reference, and
`parseProjectFile` only checks top-level key presence, never deep-
validates `reliefSettings`'s shape).

### "Detail resolution" removed entirely, not just hidden (#2)

**Decision:** the "Advanced punch detail controls" `<details>` disclosure
in `ReliefStage.tsx` (which contained only this one field) is deleted
outright. `ReliefSettings.outputResolutionPx: Px` stays in the type and
`DEFAULT_RELIEF_SETTINGS` (256px) -- unlike `minRegionPx` above, this
field is **not** renamed or removed, specifically so a project JSON saved
before this change (or one a user hand-edits) that specifies a different
resolution still loads and behaves as it did before. There's simply no
UI control that writes a different value anymore in a fresh session.
**Why 256px is the right hardcoded default:** it's the value the removed
control's own former helper text already called "a sensible default that
covers most cases" (i.e. this isn't a new judgment call, it's promoting
the previous default to the only value) -- see docs/ITERATION_03_PLAN.md
#2 for why resolution was already established (Iteration 02 Stage B
planning) as a sampling-density knob, not a physical measurement, so
hardcoding it doesn't create a units-discipline problem.

### Model-straightening rotation: mesh transform, local state (#5)

**Decision:** `Viewport3D.tsx` adds Roll/Pitch/Yaw sliders (+ "Reset
rotation") that call `mesh.rotation.set(pitchRad, yawRad, rollRad)` on
the live `THREE.Mesh` object already in the scene -- an `Object3D`
transform, not a raw `BufferGeometry` vertex mutation, and not a camera-
side workaround. Axis mapping (roll -> object-space Z, pitch -> X, yaw ->
Y) follows the aviation-style convention under this app's Y-up,
front-is-+Z world convention (`VIEW_DIRECTIONS` in `src/three/
viewport.ts`).
**Why Object3D rotation, not vertex mutation:** each slider change sets
an _absolute_ rotation value (not an incremental one applied on top of
the mesh's current transform), so there's no drift/rounding accumulation
across repeated adjustments, "Reset rotation" is trivially exact
(`{roll:0,pitch:0,yaw:0}`), and Three.js recomputes the normal matrix
from the object's world transform automatically every frame -- no need
to call `computeVertexNormals()` again after rotating, unlike a vertex
mutation approach would require. Depth capture
(`src/three/depthCapture.ts`) needed zero changes: `captureDepth` just
calls `renderer.render(scene, camera)`, which already respects whatever
transform is currently on `mesh` -- straightening a model on Import
genuinely changes what "Generate relief" captures, not just what the
preview shows.
**Why local component state, not lifted to `AppState`:** mirrors the
existing camera-view state, which is _also_ local `useRef`/`useState`
inside `Viewport3D.tsx` and already persists correctly across Import <->
Relief navigation (covered by `e2e/orient-persistence.spec.ts`) purely
because this component is never remounted between those two stages (a
single shared `<Viewport3D>` instance, same position in `App.tsx`'s JSX
tree regardless of which of the two stages is active). Rotation state
gets the identical guarantee for free, with no `AppState`/
`appReducer`/`ProjectFile` schema changes needed. A newly loaded model
(new `geometry` prop) always resets rotation to zero -- straightening is
a per-import adjustment, not a property of the mesh data itself.
**Scope:** all three axes (Roll/Pitch/Yaw) were built, not just Roll --
the reported bug (a relief rendered at a skewed diagonal angle) is
specifically a roll problem, but a model tilted around more than one axis
on import is equally plausible and three sliders cost little more than
one.
**Inconsistency noted, not fixed:** `Viewport3D.tsx`'s existing
`centerAndMeasure`/`normalizeScale` (`src/three/viewport.ts`) already
mutate raw geometry vertices directly, for a different purpose (one-time
import normalization, not live user adjustment) -- rotation deliberately
does not follow that same pattern, for the reasons above. Both approaches
coexist in the same file for different concerns; this is intentional; not
an oversight.

### Calibration/needle-setting UI removed, not deleted (#6)

**Decision:** removed from the render tree only --
`src/domain/calibration.ts`, `CalibrationEditor.tsx`, and their test
files are byte-for-byte untouched by this round. What actually changed:

- `HeightStage.tsx`: dropped the "Needle setting" table column, the
  profile-name/calibrated-status line, and the "Calibrate needle
  settings" link/button. Props `profile`/`onCalibrate` removed entirely.
- `Legend.tsx`: dropped "Needle setting"/"Measured height" columns and
  the "uncalibrated" status banner. `calibrated` prop removed.
  Region/Symbol/Yarn color/Yarn name stay -- Symbol is CLAUDE.md's
  "never rely on color alone" requirement, unrelated to calibration.
- `ExportPanel.tsx`: the entire Calibration section (`CalibrationEditor`
  usage, the `focusCalibration`/`onCalibrationFocused` scroll-and-focus
  effects, and their props) removed.
- `App.tsx`: the now-orphaned `handleCalibrate` function and the three
  `onCalibration*` handlers (their only callers were the deleted
  controls) removed, along with the `focusCalibration`/
  `setFocusCalibration` navigation-flag state.
  **What deliberately stayed wired, in App.tsx/state/appState.ts:**
  `state.calibrationProfile` (still feeds `buildLegend` -- every
  `LegendEntry` still carries `needleSettingLabel`/`needleSettingNumber`/
  `measuredHeightCm`, just unrendered -- and still feeds
  `SimulationView`/`buildReliefGeometry`'s height-lookup fallback, which
  needs a profile regardless of whether its UI is reachable);
  `state.savedProfiles` and the `SET_CALIBRATION_PROFILE`/
  `SET_SAVED_PROFILES` reducer cases (untouched); the `useEffect` in
  `App.tsx` that loads saved profiles from `localStorage` via
  `loadProfiles()` on mount (kept deliberately, even though nothing
  currently reads `state.savedProfiles` -- it's cheap, and removing it
  would mean a future reinstated calibration UI would start from an empty
  list instead of real saved data until someone remembered to re-add it).
  **Why this counts as "not defunct code" rather than a CLAUDE.md
  violation:** this is an explicit, reversible product decision ("for
  now"), not abandoned work -- the domain layer, persistence layer, and
  `CalibrationEditor` component are a complete, tested, working feature
  that simply has no current UI entry point. Re-adding an entry point is a
  render-tree change only; no domain/schema work would be needed.

### Export/print duplicate controls removed, Stage C reversed (#11)

**Decision:** `ExportPanel.tsx`'s own "Export pattern view" button group
and "Print region labels" checkbox are deleted outright. `ExportPanel`
now takes `screenView`/`screenShowGrid`/`screenMirrored`/
`screenShowLabels` props and uses them directly in all three places that
build the pattern SVG (`exportSvg`, `exportPng`, the `usePatternSvgUrl`
call backing the hidden `.print-pages` block) -- replacing the previous
`exportSettings.view`/`exportSettings.showLabels`/a
`exportSettings.orientation`-derived `mirrored` local. `PreviewStage.tsx`
threads its own existing local `view`/`showGrid`/`mirrored` state (plus
`patternViewSettings.showOnScreenLabels`) straight through as those
props -- there is exactly one set of pattern-view controls in the UI now,
not two.
**This explicitly reverses a Stage C decision** (documented earlier in
this file, "Iteration 02 Stage C" punch-guide section and the sibling
decision it references) that screen and print settings could deliberately
diverge. In practice, per the product owner's Iteration 03 feedback, this
read as redundant rather than powerful -- two nearly-identical control
sets a user had to keep in sync by hand, printing whatever the second,
easy-to-forget set happened to be set to.
**`ExportSettings.view`/`.showLabels`/`.orientation` were not removed
from the type/schema** -- they're now inert (no UI writes them), kept
only so `ProjectFile.exportSettings` round-trips old project JSON without
a schema-shape change. See the comment on `ExportSettings` in
`src/state/appState.ts`. Page size/overlap (`exportSettings.pageSize`/
`.overlapCm`) are untouched -- physical print-page sizing is a
legitimately export-only concept with no on-screen equivalent, not part
of the duplication complaint.

### Yarn color-story palettes (#7)

**Decision:** `src/domain/color/palettes.ts` bundles four hand-picked,
named palettes (Terrain, Coastal, Sunset Fade, Meadow) as a plain local
data array plus one pure transform, `applyPaletteToSwatches(swatches,
palette)`, which only ever overwrites each swatch's `color` (cycling
through the palette's colors by swatch index if there are more swatches
than colors) -- `index`/`yarnName` are always preserved, so a palette
application never clobbers a user's existing yarn naming.
**Why gated to "by-height" color mode only:** a palette is inherently a
multi-color ramp; "single yarn" mode has exactly one swatch to color
(no ramp to apply), and "source-material" mode's swatches are meant to
approximate the model's actual captured surface colors, which a
generic decorative palette would just overwrite with no relationship to
the source data.
**Why four palettes, not more:** the brief explicitly asked for "a
handful," "tasteful and small," "don't let it grow into a big feature" --
four is enough to demonstrate genuine stylistic range (earthy/cool/warm/
playful) without becoming its own sub-system (search, favorites,
custom-palette authoring, etc., all deliberately not built).
**No network calls:** all palette data is a bundled TypeScript array, per
CLAUDE.md -- no fetching a palette API or CDN-hosted swatch library.

## Iteration 03 Round 2

Implements the two carried-forward Iteration 02 Stage E findings (camera
framing, Preview mobile-narrow overflow) plus three further real bugs found
on fresh re-verification against the post-Round-1 codebase (Legend table
overflow, region-label overlap, and closing the axe-core accessibility gap)
-- see `docs/ITERATION_02_PLAN.md` §18 for the full "what was actually
built" account and which findings were confirmed as-is vs. already resolved
by Round 1's own changes.

### Camera framing: project the geometry's real extent, not an isotropic sphere (#1)

**Decision:** `src/three/viewport.ts` adds `projectedHalfExtent(box, right,
up, matrixWorld?)` -- projects a `THREE.Box3`'s 8 corners onto a given
screen-space right/up basis (optionally after a `matrixWorld` transform,
e.g. a straightened model's rotation) and returns the half-width/
half-height an orthographic frustum needs to frame it exactly for that
view direction -- and `fitOrthographicCameraToExtent(camera, extent,
paddingFactor, aspect)`, the same aspect-fill algorithm
`fitOrthographicCamera` already used, but driven by that real 2D extent
instead of a single isotropic radius. `Viewport3D.tsx` adds a `refit()`
helper (stores the geometry's own local-space bounding box in
`contentBoxRef`, reads the camera's current basis via
`camera.matrixWorld.extractBasis`, and the mesh's current rotation via
`mesh.matrixWorld`) called after every point that used to call the old
sphere-based fit: new-geometry load, standard-view button clicks, window
resize, and (newly) every model-straightening rotation change. The old
`fitOrthographicCamera`/isotropic-radius path is kept as `refit`'s fallback
for the brief window before any geometry has loaded (no bounding box to
project yet), and its own unit tests are left unchanged -- it's still a
correct, simpler special case (a sphere is the extent-based fit's limit
when `halfWidth === halfHeight` in every direction), not deleted.
**Alternative considered:** a true per-vertex silhouette projection (exact
screen-space convex hull of every actual mesh vertex, not just the 8
bounding-box corners).
**Why the bounding-box corners, not a true silhouette:** the box-corner
projection is exact for any axis-aligned standard view of an unrotated
model (which is the common case -- Import defaults to 'front' and offers
only the 6 standard views plus straightening rotation, no free-form
low-level mesh editing that would make the box a loose fit), and a safe
(never-clipping) over-estimate for an arbitrarily rotated model or
off-axis orbit angle. A punch-needle relief's source model is expected to
be a reasonably box-like/convex-ish shape to begin with (it's about to be
flattened into a bas-relief), so the bounding box is already a tight fit
in practice; a full per-vertex silhouette solver would be real additional
complexity (and a live per-frame cost during orbiting, since the
silhouette would need re-projecting continuously, unlike a fixed box)
for a shape class where it wouldn't visibly improve the result.
**Why refit only at discrete trigger points, not continuously during
orbit:** re-fitting every frame while the user is actively
orbiting/dollying with `OrbitControls` would fight their own zoom -- the
camera's frustum size is exactly the thing `OrbitControls`' scroll-to-zoom
adjusts for an orthographic camera, so continuously overwriting it would
make manual zoom impossible. Framing is instead only recomputed at the
same discrete moments a user would expect the view to "snap to a sensible
frame": loading a new model, clicking a standard-view button, resizing the
window, and straightening the model (a rotation slider change measurably
changes what's on screen for the current view direction, unlike orbiting,
which is the user actively choosing their own framing).
**A related, previously-undiscovered bug fixed in the same pass:**
`capture()`'s render target is always square (`state.reliefSettings.
outputResolutionPx` used for both width and height, `App.tsx`), but the
on-screen frustum is fit to the _container's_ aspect ratio, which is
usually not square -- rendering the capture through a mismatched frustum
silently stretches the captured depth/color non-uniformly, which then
propagates into the actual relief geometry, not just a display artifact.
`capture` now calls `refit(1)` (square aspect) immediately before
`captureDepth`, then restores the camera's prior on-screen left/right/top/
bottom afterward, so generating a relief no longer visibly changes the
live viewport's own framing.
**Left open, deliberately:** the box-corner approach's slack for an
arbitrarily-rotated model (see above) means framing isn't pixel-perfectly
tight in that case -- acceptable per the analysis above, revisit only if a
real model surfaces where it's visibly wasteful.

### Region-label collision avoidance, not a stricter size gate or leader lines (#4)

**Decision:** new `src/domain/pattern/labelPlacement.ts` exports a pure
`placeLabels(candidates, options)`: candidates are sorted by region pixel
area descending (tie-broken by id string for full determinism, never
insertion order alone), each candidate first tries its own centroid, and
on a collision with an already-placed label's box tries a small fixed ring
search (3 concentric rings x 8 compass directions, radii as multiples of
the estimated label height) before giving up and dropping that label
entirely. `buildLabels` in `src/export/svgPattern.ts` now builds
`LabelCandidate[]` (unchanged centroid/nearest-pixel anchor logic) and
calls `placeLabels` before emitting `<text>` markup, instead of rendering
every candidate's raw centroid directly. The existing `MIN_LABEL_AREA_PX`
gate (regions too small in raw pixel count to attempt a label at all) is
unchanged and runs first, before candidates ever reach `placeLabels`.
**Alternatives considered:** (a) leader lines (draw the label away from a
crowded cluster with a thin line back to the region it identifies); (b) a
stricter minimum-region-size gate tuned to the label's actual rendered
footprint rather than a fixed small pixel-area threshold.
**Why collision avoidance over leader lines:** leader lines solve the same
problem but need real placement-quality reasoning of their own (where does
the line go so it doesn't cross other regions/labels, does it read as
pointing at the right region from a distance, does it visually clash with
the pattern's other line layers -- contour, grid, punch guide,
registration marks). The nudge-then-drop approach reuses the exact visual
language the labels already have (a small stroked-halo text token sitting
directly on/near its region), asks a much narrower question (is there a
nearby free spot, yes/no), and degrades gracefully (a dropped label leaves
the region's fill/outline intact, still visually distinct, just without
its redundant text token) rather than needing a "good leader line" quality
bar to clear.
**Why not just a stricter size-only gate:** raising `MIN_LABEL_AREA_PX`
until the average label physically fits would either (a) still fail for
elongated/thin regions with a large-enough pixel _count_ but no single
wide-enough spot (a thin ring or band), which is exactly the shape class
the bug report called out, or (b) be so conservative it drops labels from
plenty of regions that could have fit fine on their own and only became a
problem because a _neighbor_ happened to be labeled at the same moment --
collision avoidance is a strictly better answer to "did two labels
actually collide," since raw region area alone can't tell you that.
**Determinism:** no randomness anywhere in the algorithm (fixed sort order,
fixed compass-direction/ring-radius search sequence) -- the same
`RegionMap` and settings always produce the same rendered labels, per
CLAUDE.md's determinism requirement (this isn't pseudo-random generation in
the `src/domain/random.ts` sense, but the same "same input, same output"
principle applies).
**Left open, deliberately:** the label-width estimate
(`id.length * LABEL_CHAR_WIDTH`, a fixed average-glyph-width heuristic) is
an approximation, not a real text-measurement API (no `<canvas>`
`measureText` call, since `src/export/svgPattern.ts` must stay usable
outside a browser/DOM context per CLAUDE.md's architecture boundaries) --
good enough for the AABB overlap test's purposes, not pixel-exact.

### Camera-framing and mobile-layout fixes carry no schema/persistence changes

**Decision:** none of the Round 2 fixes touch `ProjectFile`,
`AppState`, or any persisted setting -- camera framing is purely
`Viewport3D.tsx`-local derived behavior (see above, mirrors how rotation
state is already local per the Iteration 03 Round 1 rotation decision);
the Preview two-column layout and Legend table wrapper are CSS-only; label
placement is a pure function of the already-persisted `RegionMap`/
`LegendEntry[]` data, not a new setting. No `PROJECT_SCHEMA_VERSION` bump,
no new `AppState` fields, no new UI controls (a printed/exported pattern
from an old project JSON will simply render with legible, non-overlapping
labels the next time it's regenerated, with nothing new for a user to
configure).

## Iteration 03 — Combined Workspace (#13)

Collapses the 5-stage wizard (Import, Create relief, Height levels, Yarn
colors, Preview) into 2 stages (Import, Workspace) per
`docs/ITERATION_03_PLAN.md` #13. The largest single change of the
engagement -- went through its own plan doc, an independent pre-
implementation review, and an independent post-implementation diff
review, per that point's explicit process requirement.

### Model-straightening rotation: lifted to AppState, not duplicated (Wrinkle A)

**The problem:** Roll/Pitch/Yaw rotation (Iteration 03 Round 1, #5) lived
as local `useState` inside `Viewport3D.tsx` -- the component whose live
Three.js scene `capture()` actually reads from. The approved mockup put
the rotation controls on Workspace's "Finished-piece simulation" panel,
which renders `SimulationView.tsx` -- a wholly separate scene built from
the _processed_ `RegionMap`, with no rotation awareness and no connection
to `Viewport3D` at all.

**Decision:** lift rotation into `AppState.modelRotationDeg` (`src/state/
appState.ts`, a `{roll, pitch, yaw}` record in degrees, default `{0,0,0}`,
`RotationDeg` type now canonically defined there) with a
`SET_MODEL_ROTATION` action (`Partial<RotationDeg>`, shallow-merged like
`SET_RELIEF_SETTINGS`). `Viewport3D.tsx` becomes a _controlled_ component
for rotation -- `rotationDeg`/`onRotationChange` props replace its former
local state; the existing rotation-apply effect (mesh transform + Round
2's `refit()` camera-framing) is unchanged in behavior, just keyed off the
prop instead. The slider UI itself is extracted verbatim into a new
shared, purely presentational `src/components/RotationControls.tsx`
(`rotationDeg`/`onAxisChange`/`onReset`/`idPrefix` props, no domain logic),
rendered in two places bound to the same `AppState` value: inside
`Viewport3D` (Import only, see below) and inside the new `src/components/
workspace/SimulationPanel.tsx` (Workspace's Finished-piece simulation
panel) -- so adjusting rotation from either location writes to, and is
immediately visible from, the other.

**Why lift to AppState rather than "render `Viewport3D` in the simulation
slot" (the lower-risk alternative also considered):** the brief's own
wording -- "SimulationView.tsx content ... PLUS rotation controls" --
requires both the yarn-colored/pile-textured simulation render _and_
working rotation to coexist in that panel. Swapping in the raw-model
`Viewport3D` view would have thrown away the actual simulation render the
product owner explicitly asked to keep, not just been lower-fidelity to
the mockup. Rejected.

**`Viewport3D` stays mounted continuously across Import and Workspace**
(same guarantee `e2e/orient-persistence.spec.ts` already covered before
this change, now covering Import↔Workspace instead of Import↔Relief) --
required because `capture()` reads the live WebGL scene this component
owns; unmounting it would tear that down and break relief generation
entirely, not just the visual. During Workspace, its wrapper gets
`.visually-hidden` (existing sr-only utility class, reused verbatim --
kept `display`-non-`none` deliberately, since `capture()`'s
`WebGLRenderTarget` readback is sized by its own explicit `resolution`
argument, completely independent of the on-screen container's pixel size,
so hiding the container to ~1×1px does not affect capture correctness)
**plus** `aria-hidden="true"` on that same wrapper -- `.visually-hidden`'s
whole purpose is the opposite of this (keep content _announced_ to screen
readers, the sr-only-text pattern), which is backwards for a `role="img"
aria-label="3D model viewport"` landmark that should be fully inert while
off-screen; `aria-hidden` suppresses it from the accessibility tree
entirely, `.visually-hidden`'s CSS keeps it visually gone. Found and fixed
during this implementation's own real-browser verification, not left as a
residual gap.

`Viewport3D` also gained a `showControls?: boolean` prop (default `true`).
When `false` (Workspace), the standard-view button row and
`<RotationControls>` are not rendered at all -- a real conditional
unmount of just that JSX, not CSS-hidden -- while the canvas container div
(the one thing that must never conditionally mount/unmount) always
renders regardless. This is what prevents two simultaneous accessible
"Roll"/"Pitch"/"Yaw" controls existing in the DOM at once: a
visually-hidden-but-still-focusable duplicate would have been a real
keyboard-accessibility anti-pattern (tabbing into a control you can't
see), and would have made `getByLabel(/^Roll/)`-style test queries
genuinely ambiguous between the two instances, not just messy. Verified
directly (both via a real browser session and the e2e suite) that exactly
one `[aria-label="Straighten model"]` group exists in the DOM at any time.

**Rotation stays on Import too, not removed.** The brief asks for
rotation "accessible from here [Workspace] rather than only on the
separate Import step" -- not instead of. Both locations write the same
`AppState` value, so this costs one extra small component render, not a
second source of truth, and avoids regressing the Import-stage
straightening workflow.

**`ProjectFile` still excludes rotation**, unchanged from the original
Round 1 decision -- lifting the state's _location_ doesn't change its
_lifecycle_: still reset to zero on `SET_SOURCE` (a fresh import), still
per-import and ephemeral, not project data. `handleSaveProjectJson` in
`App.tsx` explicitly does not include `modelRotationDeg`.

### Live regeneration: debounce interval, and a generation counter over cancellation (Wrinkle B)

**The problem:** replace the manual "Generate relief" button
(`App.tsx`'s former `handleGenerateRelief`) with regeneration that fires
automatically as settings change, without a slower, now-stale worker
result overwriting a newer one if the user changes a setting again before
the first request finishes.

**Debounce interval: 300ms.** Profiled via a real headless-Chromium
session (this exact branch's build, `Concentric Ripple` sample, 12 pile
heights -- the worst case on the level-count axis, resolution fixed at
256px per Round 1). One clean, uncontended measurement (a self-contained
JS poll loop using `performance.now()` deltas, taken immediately after a
real user gesture so the tab hadn't yet been subject to Chrome's
background-tab timer throttling) gave **~196ms** end-to-end for capture →
worker round-trip → React re-render. Repeated-measurement attempts after
that were corrupted by exactly that throttling (Chrome clamps background-
tab timers to ~1Hz; readings came back suspiciously exact at ~1000.0ms
across otherwise-varying inputs, a known symptom, not real work) and were
discarded rather than used. Architecturally, ~196ms is expected to be
representative and not a fluke: the capture is a `256×256`
(65,536px) float `WebGLRenderTarget` readback (a few ms on any real GPU),
the worker payload is a few-hundred-KB typed array (cheap to structured-
clone), and every per-pixel domain function
(mask/normalize/invert/intensity/smooth/quantize/cleanup) already runs
off-main-thread per CLAUDE.md's existing worker-based-processing decision.
300ms leaves roughly 100ms of headroom above the one clean measurement for
slower real-world hardware, while staying under the point a live control
starts to feel laggy -- an engineering judgment call, not re-derived from
a formula; see `src/hooks/useLiveRelief.ts`'s own doc comment for the same
account.

**Correctness: a monotonic generation counter, not `AbortController`-style
cancellation.** `useProcessingWorker`'s single long-lived `Worker` has no
real cancellation primitive -- terminating/recreating it per keystroke
would be wasteful and lose in-flight work for nothing, so an in-flight
request is left to run to completion, and a generation counter decides
whether its result is _applied_:

```
generationRef starts at 0
effect deps: [hasModel, reliefSettings, rotationDeg]  // reference
                                                       // identity; every
                                                       // real dispatch
                                                       // produces a new
                                                       // object
on every effect run (i.e. every real trigger):
  generationRef.current += 1        // bumped synchronously, before the
                                     // debounce timer even fires --
                                     // invalidates a still-in-flight
                                     // older request the instant a newer
                                     // trigger is observed, not just at
                                     // that older request's own
                                     // completion
  clear any pending debounce timeout (effect cleanup)
  schedule setTimeout(300ms):
    myGeneration = generationRef.current
    captured = capture(resolutionPx, captureColor)
    if (!captured) return                       // nothing to capture
                                                  // yet -- silent no-op,
                                                  // no onStart
    onStart()                                    // -> PROCESSING_STARTED
    result = await process(buildProcessArgs(captured))
    if (generationRef.current !== myGeneration) return   // superseded,
                                                          // discard
    onSuccess(result, captured.width, captured.height)   // -> PROCESSING_SUCCEEDED
```

(`onError` is guarded the same way `onSuccess` is, so a late-arriving
stale failure can never clobber a newer success.) Bumping the counter
synchronously in the effect body -- not inside the timer -- is what lets a
request that has _already started_ be invalidated the moment a newer
trigger appears, rather than only once that older request eventually
resolves; this is deliberate, not an oversight, and is exactly the
property `src/hooks/__tests__/useLiveRelief.test.ts`'s out-of-order-
completion test locks in (trigger A, let it start; trigger B while A is
still pending; resolve A _after_ B has started; assert A's result is
discarded and only B's is applied).

**What triggers regeneration vs. what doesn't**, matching the brief's own
explicit carve-out: every `ReliefSettings` field reachable via the single
`reliefSettings` object reference (`levels`, `intensity`, `invert`,
`smoothingStrength`, `edgePreservation`, `quantizationMode`,
`minRegionPreset`) plus `modelRotationDeg` trigger it; yarn swatch colors,
color-mode switching, `paletteSize`, pattern view-mode/grid/mirrored/
labels/punch-guide, and pile-style/lighting/fabric-color do not -- these
only redraw already-computed data (`PatternCanvas`/`SimulationView` from
the current `regionMap`/`legend`), never reaching `useLiveRelief` at all.
**Known, narrow, pre-existing edge case, not a new regression:** switching
_into_ `source-material` color mode (or changing `paletteSize` while
already in it) doesn't by itself re-run the worker's color quantization --
identical to the old manual-button flow, where the same change also
required a fresh "Generate relief" click to take effect. `useLiveRelief`
reads current `colorMode`/`paletteSize` fresh every time it _does_ fire
(via a ref-to-latest-options pattern), so any real relief-settings/
rotation trigger afterward correctly captures color under whatever mode
is active at that moment -- the gap is narrow (mode/size changed and
nothing else touched since) and behavior-identical to before.

**Not stage-gated, deliberately.** `useLiveRelief`'s effect depends only
on `hasModel`/`reliefSettings`/`rotationDeg`, never on
`workflow.currentStage` -- it fires as soon as a model loads, regardless
of whether the user is currently on Import or Workspace. This means a
relief is often already generating (or finished) by the time the user
navigates from Import to Workspace, matching how a slicer's preview stays
live behind the scenes rather than waiting for a specific page to be
open. One consequence, found while writing e2e coverage: a test that
tried to assert Workspace's "Generating your first relief…" placeholder
is visible immediately after navigating there is inherently racy (the
first generation's 300ms debounce often elapses during the test's own
navigation/assertion overhead) -- not a bug, just not a state worth
pinning exactly; the corresponding accessibility-sweep test checks
Workspace "on arrival" without requiring that specific transient state.

**The rail's live-status pill** ("● Live — updates as you adjust" / "●
Processing…") reflects `AppState.processing` directly, set/cleared by
`onStart`/`onSuccess`/`onError` above -- genuinely tied to whether a
generation the app currently considers _current_ is in flight, not a
cosmetic label. If settings change again while a request is already
in-flight, the pill correctly stays on "Processing…" through the whole
overlapping-changes window (each new trigger's own `onStart` is
idempotent; only the _latest_ generation's `onSuccess`/`onError`
resolves it), never flickering back to "Live" on a result that's about
to be superseded.

### Rail grouping: HeightStage's table becomes live chips, its warning moves (a judgment call)

The former `HeightStage.tsx` (its own page) is absorbed into
`src/components/workspace/ReliefControls.tsx`'s "Needle & pile" group as
a live per-level coverage-percentage chip row (`H1 17.7%`, `H2 13.4%`,
...), directly under the pile-heights slider it's live feedback for --
per the brief's own framing ("really just live feedback for that one
control, not a destination"). `HeightStage`'s small-region warning
(`findSmallRegions`, unchanged domain call) is **not** kept alongside the
chips; it moves into the "Punch detail" group instead, directly under the
`minRegionPreset` select that actually drives it. The brief left this
placement to implementer judgment ("your call based on what's cleanest")
-- chosen so the control a user would reach for in response to the
warning (raise the minimum region size) sits immediately below the
warning itself, rather than in a different group entirely.

### `ExportPanel` reuses its existing shape unchanged; the rail gates it like the preview panels

`ExportPanel.tsx` itself needed **no internal changes** -- it already
reads `screenView`/`screenShowGrid`/`screenMirrored`/`screenShowLabels`
as props (Iteration 03 Round 1) and already renders as a self-contained
`<details className="export-panel">` block, which is exactly the shape
"one more collapsed section in the rail" needed. What changed is _where_
those screen-state props come from: `view`/`showGrid`/`mirrored` (local
`useState` inside the old `PreviewStage.tsx`, passed down only to its
child `PatternCanvas`/`ExportPanel`) move up into `Workspace.tsx`, since
`PatternPanel` and `ExportPanel` are now _siblings_ in the rail rather
than parent/child -- both need the same values as controlled props from
one shared owner. `Workspace.tsx` also gates `ExportPanel` on
`regionMap && processed`, the same not-ready-yet condition
`PatternPanel`/`SimulationPanel` are gated on, with a rail placeholder
("Export & print will be available once the first relief has generated.")
in the interim -- `ExportPanel` requires a non-null `RegionMap`, and
before the first live generation lands there isn't one yet. This gating
gap (and the `view`/`showGrid`/`mirrored` lift) were both found by the
independent pre-implementation plan review, not left implicit.

### Print output: `.screen-only` must wrap the rail and preview column, but never `ExportPanel`

Every prior stage's on-screen content was wrapped in `.screen-only`
(`display:none !important` under `@media print`) so print output shows
only the intended `.print-pages` block, not live app chrome. `Workspace.tsx`
initially had no such wrapper at all (an internal gap, not present in any
released version) -- found and fixed via this implementation's own
Playwright print-emulation testing, not left for a later pass. The fix:
`.screen-only` wraps the rail's heading/`ReliefControls`/`YarnColorsGroup`
(and, separately, the not-ready-yet Export placeholder) in one wrapper,
and the entire `.workspace-preview-col` in another -- but **deliberately
not** `ExportPanel` itself, which renders its own `.print-pages` block as
a sibling of its `<details>`; nesting `ExportPanel` inside a `.screen-only`
ancestor would have hidden `.print-pages` too, since a `display:none`
ancestor can't be overridden by any descendant's own display rule.
`ExportPanel`'s `<details>` is still separately hidden in print via the
pre-existing `.export-panel` selector in `styles.css`'s `@media print`
block, unchanged.

A second, related bug found by the same testing pass: `main.workspace-
layout`'s CSS grid (`grid-template-columns: minmax(0,1fr)
minmax(280px,420px)`) stayed active during print, since Export & print
now lives _inside_ that grid-classed `<main>` -- unlike the old
`PreviewStage`, which was never itself a grid page (`relief-layout`/now
`workspace-layout` was only ever applied on the stage that needed the
sticky preview). An explicit grid track still reserves its sizing even
when the item occupying it is `display:none` (`.workspace-preview-col`,
hidden by `.screen-only` in print), so `.print-pages` -- a normal-flow
child of the grid's _first_ column -- was being squeezed into a
much-too-narrow column (one measured case: literally zero width) instead
of the full print-page width. Fixed with `@media print { main.workspace-
layout { display: block; padding: 0; } }`, mirroring the pre-existing
`.stage-panel` print reset that already resets on-screen width/padding
constraints for print in the same block.

### CSS class renames, and `.preview-columns` removal

`.relief-layout`/`.relief-controls-col`/`.relief-preview-col` (Iteration
02 Stage B's sticky-preview mechanism) are renamed to `.workspace-layout`/
`.workspace-controls-col`/`.workspace-preview-col` -- same rules, reused
verbatim per the brief's explicit instruction, renamed only because
"relief" is no longer a distinct stage. `.preview-columns` (Round 2's
Preview-stage side-by-side pattern/simulation grid) is removed outright,
not renamed -- Workspace's preview column stacks Pattern and
Finished-piece simulation _vertically_ now (two full-width panels, not a
2-column grid), so the class had no remaining call site; confirmed via
grep before removal.

### Two simultaneous WebGL scenes during Workspace: an accepted trade-off

While on Workspace, two `requestAnimationFrame` render loops run at once:
`Viewport3D`'s (hidden, kept alive only so `capture()` keeps working) and
`SimulationView`'s (visible, the actual Finished-piece simulation). Both
are small, simple scenes (a handful of meshes/lights each), so the
overhead is not expected to be meaningfully different from either
component's existing pre-this-change cost run alone -- not optimized
further, accepted as the cost of keeping `capture()`'s WebGL-scene
dependency correct without a more invasive redesign (e.g., a headless/
offscreen capture path independent of the on-screen `Viewport3D`
instance, which would be real additional complexity for a cost that
hasn't been shown to matter in practice).

### `vitest.config.ts`: exclude nested git worktrees

Unrelated to the feature itself, but found and fixed during this
implementation's own local verification: `vitest.config.ts`'s `exclude`
list (`['e2e/**', 'node_modules/**']`) doesn't match nested paths like
`.claude/worktrees/*/node_modules/**` (this project's multi-agent
worktree convention keeps other agents' full checkouts, each with their
own `node_modules` and test files, inside the same repo directory).
Providing a custom Vitest `exclude` _replaces_ (rather than extends)
Vitest's own sensible defaults, which would otherwise have caught this.
`npm run test` from a checkout with sibling worktrees present was
discovering and running their test files too (one observed run went from
this project's real ~33 test files to 202, most of them stale copies from
other in-progress worktrees), producing meaningless pass/fail signal that
had to be worked around with an explicit `src`-path scope before the real
fix was made. Fixed by
adding `'.claude/worktrees/**'` to the exclude list -- a narrow, one-line
fix with no effect on any worktree's own copy of this same config file.

## Workspace usability fixes (post-Iteration-03 audit)

A separate hands-on usability audit of the just-shipped combined-Workspace
redesign (see the section above), using a real 74MB STL file rather than a
synthetic sample, found five concrete, precisely root-caused problems.
Fixed on branch `feat/workspace-usability-fixes`, one commit per item
below. All five were re-verified against the actual code before a fix was
proposed (line numbers/values in the audit were treated as recent but not
authoritative), and the sticky-preview and viewport-order fixes were
confirmed working in a real running browser (`getBoundingClientRect`/
`getComputedStyle` measurements), not just inferred from reading CSS.

### 1. Sticky preview column: independent scroll boundary, not a shorter-sibling accident

**Decision:** `main.workspace-layout > .workspace-preview-col`
(`src/styles.css`) gets `max-height: calc(100vh - 2 * var(--space-3));
overflow-y: auto; overscroll-behavior: contain;`, reset to `max-height:
none; overflow-y: visible;` alongside the existing `position: static` in
the `@media (max-width: 720px)` mobile fallback.

**Root cause:** a CSS grid row auto-sizes to the _taller_ of its two
column children's natural content height. `.workspace-preview-col`'s
`position: sticky` had no explicit height cap, so in the default/light
state (4 pile levels, single color, nothing expanded -- what every new
user sees first) the preview column's own natural height exceeded the
rail's, meaning the preview column's natural height _was_ the row height
-- leaving the column's own containing block zero taller than the column
itself, so `position: sticky` had no slack to pin within and the column
just scrolled in lockstep with the page. It only worked once heavier use
(more pile levels, an open disclosure, more swatches) grew the rail past
the preview column's natural height by accident.

**Why a height cap fixes both states, not just relocates the bug:**
capping the column's own height means its contribution to the grid row's
auto-sizing is always `<= 100vh - 32px`, so the rail (which only grows
from a modest baseline) reliably becomes the taller sibling for any
realistic rail content -- confirmed against a running build at both the
light state (rail ~1444px) and a heavy state (12 pile levels, "Advanced
shape controls" open, color-by-height with 12 swatches; rail ~2461px):
both pinned correctly, `getBoundingClientRect().top` staying at the
pinned `16px` across multiple scroll positions in each state. The column
becomes independently scrollable for its own contents (Pattern +
Finished-piece simulation + Legend) once they exceed the cap, rather than
relying on page scroll -- a deliberate, common pattern (this is the same
"cap + own scrollbar" shape as, e.g., a sidebar in most IDEs), not merely
a workaround.

**Alternative considered:** pinning only the Pattern panel specifically
(since that's what most rail controls actually affect) and letting
Simulation/Legend scroll beneath it inside the column. Rejected as more
complex (a second nested sticky/scroll boundary, more surface area for
the Three.js canvas's own resize handling to interact badly with) for no
clear benefit over capping the whole column, which already keeps all
three panels reachable via one predictable scroll gesture.

**Test strengthened, not just re-passed:** `e2e/workspace.spec.ts`'s
sticky-position test previously only asserted `getComputedStyle(el)
.position === 'sticky'` -- true the entire time the bug shipped, since it
only checks the CSS declaration exists, not that the element visually
stays pinned during a real scroll. Replaced with two new tests (light
state, heavy state) that scroll the page and assert
`getBoundingClientRect().top` stays within 2px of the pinned `top` value
at each scroll position, per the task's explicit requirement that a
state-dependent bug needs both states covered, not just one.

### 2. Import viewport moved above the fold: a real DOM reorder, not CSS `order`

**Decision:** in `src/App.tsx`, `ImportOrientSection` (heading,
explanatory text, "Continue to Workspace" button) is rendered in a new
top-level JSX conditional slot placed _after_ the Viewport3D conditional
block, instead of nested inside the earlier `workflow.currentStage ===
'import'` fragment (which rendered it _before_ Viewport3D). Viewport3D's
own conditional block is completely untouched -- same source position,
same guard condition.

**Root cause:** on the Import stage, `<main>` has no flex/grid layout
class, so DOM order is visual order. The prior order (ImportStage samples/
dropzone -> warning -> orient heading/text/button -> Viewport3D) meant a
user could reach and click "Continue to Workspace" -- fully visible above
the fold -- without the 3D viewport they're meant to orient ever
scrolling into view (confirmed by the audit at 1440x900: viewport top at
929.6px, entirely below a 900px-tall window).

**Why a real DOM reorder instead of the brief's suggested CSS `order`:**
the "never remount across Import <-> Workspace" invariant this must
preserve (`e2e/orient-persistence.spec.ts`, and the original sticky-
preview entry above) only requires that Viewport3D's _own_ JSX slot stay
positionally stable among `<main>`'s children across renders -- it does
not require `ImportOrientSection` to stay adjacent to or before it. Since
Viewport3D's block was always a separate, later sibling from
`ImportOrientSection`'s original nested position (not literally adjacent
in the source), moving only `ImportOrientSection` to a new slot after it
changes visual, DOM, _and_ tab order together, consistently -- with no
CSS needed. This is a strictly better outcome than CSS `order` would have
given: CSS `order` reorders visual position while leaving tab order at
the old DOM position, a real keyboard-user mismatch (WCAG 2.4.3 focus-
order territory) that this approach avoids entirely by not needing it.

**Verified working in a real browser** (not just inferred from JSX): at
1440x900 with the "Concentric Ripple" sample, the 3D viewport (dark
canvas) now starts at `top: 723px` -- visible without any scrolling --
versus the pre-fix baseline of `929.6px` (below the fold). A screenshot at
this viewport shows the canvas visible immediately beneath "Or import your
own."

**Trade-off flagged, not silently accepted:** the "Orient the model"
heading now reads, in DOM/tab order, _after_ the viewport it describes --
a minor inversion of the usual "heading precedes its content" convention.
The viewport has its own independent `aria-label="3D model viewport"` /
`role="img"` (`Viewport3D.tsx`), so it isn't orphaned or unlabeled for a
screen-reader user, just encountered in a different order. A version that
splits `ImportOrientSection` into a heading/intro half (rendered before
Viewport3D) and a button-only half (rendered after) would give strictly
better heading-before-content order at the cost of a real component split
and more test churn (`src/components/__tests__/ImportStage.test.tsx`
currently renders `ImportOrientSection` as one unit) -- not done here,
left as a possible future refinement if this specific ordering nuance
becomes a real complaint rather than a theoretical one.

**Test coverage:** `e2e/orient-persistence.spec.ts` gained a new test
asserting the viewport's `getBoundingClientRect().top` is `< 900` (visible
without scrolling) and less than the Continue button's `top` (viewport
genuinely precedes the button visually), at a realistic 1440x900 window --
not an artificially tall test window, which would trivially mask the bug.
The three pre-existing orientation-persistence tests in that file pass
unmodified in their actual assertions.

### 3 & 4. Rail jump-nav, sticky mini-headers, and reachable Export & print -- one combined fix

**Decision:** a single new "Jump to:" nav row (`.rail-jump-nav` in
`Workspace.tsx`, styled in `styles.css`) directly under the existing
`.workspace-rail-heading`, with one button per top-level rail section
(Needle & pile / Punch detail / Shape interpretation / Yarn colors /
Export & print), each scrolling its target into view via
`document.getElementById(id).scrollIntoView({ behavior: 'smooth', block:
'start' })`. Combined with sticky `<h3>` mini-headers via a new
`.rail-section` class applied to exactly those same 4 top-level groups
(`ReliefControls.tsx` x3, `YarnColorsGroup.tsx` x1).

**Why one fix for two numbered items:** #3 asked for a jump-nav and/or
sticky headers as a small navigational aid; #4 asked for a persistent,
easy-to-find affordance for "Export & print" specifically. A jump-nav row
that includes an Export & print entry satisfies both at once, rather than
building a separate dedicated "Export" button elsewhere in the rail that
would duplicate the jump-nav's own Export entry.

**Why `.rail-section` excludes the nested "Color story palettes" group:**
`YarnColorsGroup.tsx` nests a second `.control-group` ("Color story
palettes") inside the top-level "Yarn colors" group when color-by-height
mode is active. A selector matching every `.control-group h3` regardless
of nesting would let both headers try to stick at `top: 0`
simultaneously once the user has scrolled past the outer group's top but
is still within the nested group's bounds -- two sticky boxes rendering at
the same position, one visually covering the other. `.rail-section` is
applied only to the 4 top-level groups (via an explicit class, not a
`:not()` exclusion on the nested group), so the nested header stays
`position: static` and never competes. Confirmed in a running browser:
scrolling into the "Yarn colors" section sticks its own `<h3>` at `top:
0`, while the nested "Color story palettes" heading (revealed by
switching to color-by-height mode) remains `position: static` throughout.

**Export & print reachability:** the jump-nav's Export & print button
both scrolls to and opens the `<details>` disclosure in one click, since
it's otherwise the last thing in the rail after every color swatch.
`ExportPanel.tsx`'s previously-local `detailsOpen` `useState` is lifted
into an optional controlled `open`/`onOpenChange` prop pair (`Workspace
.tsx` owns the state and passes both); when neither prop is supplied, the
component falls back to its own internal `useState`, so the 7 existing
`ExportPanel.test.tsx` render call sites (none of which pass these props)
keep working completely unchanged. Passing only one of the two props is
a real footgun (documented inline in `ExportPanel.tsx`): `open` alone
pins the disclosure to a fixed value while click-driven writes go to an
internal state the display no longer reads, and `onOpenChange` alone
observes clicks that never actually open/close anything, since the
displayed `open` value still falls back to internal state. The one real
caller (`Workspace.tsx`) always passes both together.

**Scroll target for the not-yet-generated placeholder:** before the first
relief has generated, `Workspace.tsx` renders a plain placeholder div
instead of the real `ExportPanel` ("Export & print will be available once
the first relief has generated") -- it shares the `id="rail-export-print"`
with the real panel's `<details>`, so the jump-nav's Export button always
has a valid scroll target regardless of generation state.

**A known, accepted rough edge:** because "Export & print" is the very
last section in the rail, `scrollIntoView({ block: 'start' })` cannot
always align its heading flush with the viewport top -- there's nothing
below it left to scroll past, so at the document's max scroll position the
disclosure lands partway down the viewport instead of at the very top
(confirmed in a running browser: ~302px from the top in a heavy-swatch
state, not 0). Still a large, reliable improvement over the pre-fix state
(requiring a full manual scroll through the entire rail), and adding
artificial bottom padding to the rail just to force perfect top-alignment
was judged not worth the empty visual space it would introduce for a
one-section edge case.

**Test coverage:** two new tests in `e2e/workspace.spec.ts` -- one
exercising every jump-nav button (confirming Shape interpretation's
heading lands near the viewport top, and Export & print both opens and
scrolls into view), one confirming a top-level section's `<h3>` sticks at
`top: 0` while scrolled within its own section, and that the nested
"Color story palettes" heading stays `position: static`.

**Ripple effect on existing e2e tests:** the jump-nav's "Export & print"
button text duplicates the `<summary>`'s own text, so `page.getByText
('Export & print', { exact: true })` -- used across 6 existing test files
(`workspace.spec.ts`, `accessibility.spec.ts`, `main-workflow.spec.ts`,
`print-emulation.spec.ts`, and three call sites in
`preview-controls.spec.ts`) to open the disclosure -- became ambiguous
(two matching elements). All 7 call sites were updated to
`page.locator('.export-panel summary')`, which is both unambiguous and
more precisely targeted at the actual disclosure toggle than a text match
ever was.

### 5. Mobile-overflow at 375px: reproduced with the exact missing precondition, root-caused, fixed

**Outcome: reproduces, root-caused precisely, fixed.** A previously-
reported 375px-width horizontal-overflow bug (`document.documentElement
.scrollWidth: 420` vs `clientWidth: 375`) could not be reproduced by an
earlier follow-up audit that toggled every discrete control (disclosures,
palettes, pattern-view buttons, checkboxes) at 375px width on both a local
build and the live deployment. That audit's own working theory -- untested
at the time -- was that the original overflow was found while the
small-region warning banner ("N region(s) are smaller than the minimum
punchable size... may be difficult to punch reliably", `ReliefControls
.tsx`) was actively showing, a state its control-toggling sweep never
happened to trigger.

**This investigation deliberately reproduced that exact state** rather
than continuing to guess. First attempted with the built-in samples
(Concentric Ripple, Rounded Relief, Geometric Steps) under combinations of
the "Bold & simple" min-region preset, 12 pile levels, and model rotation
up to 40 degrees on multiple axes -- **none of these triggered the
warning banner.** Root cause: `cleanupTinyRegions`
(`src/domain/regionCleanup.ts`) runs with the _same_ threshold the warning
check later reads, and only leaves a region unmerged when
`neighborCounts.size === 0` -- i.e., every one of its bordering pixels is
background, with no other foreground region to merge into. The three
built-in samples are smooth, single-blob height fields; every small region
they can produce borders _some_ other foreground region and gets merged
away during generation, before the warning check ever sees it.

**Reliable reproduction required a genuinely disconnected shape.** Built
`e2e/fixtures/sliver.stl`: one 20x20x20 cube plus one small
(0.3x0.15x0.3), fully separated sliver positioned well outside it (x in
[18, 18.3] vs. the cube's [-10, 10]). Captured from the front view, the
sliver projects as an isolated foreground island bordered entirely by
background -- `cleanupTinyRegions`'s one exception -- so it survives
cleanup at the _default_ "Balanced" preset with no setting changes needed,
and the warning banner fires reliably.

**First-pass local testing found no overflow -- CI proved that
conclusion wrong, for an instructive reason.** Confirmed by hand against a
running build (macOS, local Chromium/WebKit) at both 375px and the
project's own 390px mobile-narrow width: banner genuinely showing, zero
horizontal overflow by every measurement taken at the time. But this
branch's own CI run (`npm run test:e2e` on GitHub Actions' Ubuntu
runner) failed the new regression test with real overflow (the test at
that point only asserted a boolean, so the exact pixel numbers weren't
captured -- see the diagnostics work below) on both `chromium` and
`mobile-narrow` (WebKit) projects. The CI failure screenshot showed the
actual culprit clearly: the Workspace rail heading's live-status pill
("● Live -- updates as you adjust") and the new jump-nav's button row
both visibly cut off at the right edge.

**Real root cause, once looked at directly:** `.workspace-rail-heading`
(`src/styles.css`) is `display: flex` with no `flex-wrap`, and
`.live-status-pill` has `white-space: nowrap` -- so the pill can never
shrink below its full un-wrapped text width, and the row has no way to
move it to a second line when space runs out. This is a genuine,
pre-existing bug from Iteration 03's combined-workspace change (not
something this branch's other fixes introduced), it just needed the
right combination of narrow viewport _and_ wider font-rendering metrics
to actually overflow -- CI's Ubuntu runner falls back much further down
this app's font stack (`'Iowan Old Style', 'Palatino Linotype', Georgia,
'Segoe UI', system-ui, sans-serif` -- none of the first four exist on
Linux) than macOS does, rendering this text measurably wider. This is
exactly why local-only verification on one OS's font stack isn't
sufficient for a horizontal-overflow claim, and why "does not reproduce"
was the wrong conclusion to leave standing once contradicting evidence
appeared -- corrected here rather than left in place.

**Fix, round 1:** `flex-wrap: wrap` added to `.workspace-rail-heading`, so
the pill drops to its own line instead of forcing the row wider than its
container. `.rail-jump-nav button` also gets an explicit `white-space:
normal` as defensive hardening for the same class of bug (buttons don't
reliably wrap their own text across engines without it, and the parent's
existing `flex-wrap: wrap` can only move whole buttons to a new line, not
shrink one below its own un-wrapped width). Verified structurally sound
by forcing every element to a much wider fallback font (`'Courier New',
monospace`) in a running local build at 375px -- a deliberately more
extreme metrics shift than CI's actual font substitution -- and
confirming zero overflow, both via `scrollWidth`/`clientWidth` and
visually (the pill and jump-nav buttons wrap cleanly onto their own
rows).

**Round 1 fixed the visible symptom but CI still failed** -- with no
cut-off content in either failure screenshot this time, meaning the
remaining overflow was small and needed better diagnostics, not another
guess. The regression test was extended to report the widest few elements
by `getBoundingClientRect().right` directly in the assertion failure
message (`e2e/preview-controls.spec.ts`), rather than downloading and
reading CI artifacts by hand for each iteration. The next CI run pinpointed
it precisely: `scrollWidth=383 clientWidth=375`, widest element `<header
class="app-header">` at `right: 383.03px` on `chromium`, `379px` on
`mobile-narrow`.

**Round 2 root cause and fix:** `.app-header` (`src/styles.css`) has the
exact same missing-`flex-wrap` shape as `.workspace-rail-heading` above --
`display: flex; align-items: baseline;` with no `flex-wrap`, holding the
`<h1>`/tagline `<p>` pair. This element predates Iteration 03 entirely
(it's the app's original top banner) and sits on every stage, not just
Workspace -- it just also needed CI's real Linux font substitution to
actually overflow at 375px. Fixed identically: `flex-wrap: wrap` added, so
the tagline drops below the title instead of overflowing.

**Round 2's fix did not close it out -- the next CI run reported the
exact same `right: 383.03px`, unchanged.** That was the tell: if fixing
`.app-header` had actually mattered, the number should have moved. The
diagnostics were extended again to report the widest 5 elements, not
just 1 -- the next failure showed `<header class="app-header">`,
`<nav class="stage-nav">`, `<main class="workspace-layout">`,
`.workspace-controls-col`, and `.screen-only` **all tied at the identical
`right: 383.03px`** -- five unrelated elements at different DOM depths
sharing one exact pixel value is not five independent bugs, it's one
shared ancestor being forced wide and every descendant just inheriting
its width.

**Round 3, the actual systemic root cause:** `.app-shell`'s mobile
`@media (max-width: 720px)` rule sets `grid-template-columns: 1fr` (bare,
not `minmax(0, 1fr)`). A bare `1fr` grid track has an implicit `auto`
(content-based) minimum -- so _any_ descendant anywhere in that column
with a wide enough min-content (a long unbreakable string, a wide
`<select>`, anything) forces the entire single-column track, and
therefore the whole page, wider than the viewport, no matter how much
`flex-wrap` gets added to individual rows inside it. Rounds 1 and 2 both
made real, worthwhile fixes (two genuine missing-`flex-wrap` bugs, still
correct and still needed), but neither could fully close this out without
also fixing the ancestor track's sizing -- which is exactly why the
`.app-header` fix left the failure's exact pixel value unchanged: some
other, unidentified descendant was still forcing the same shared column
width, and `.app-header` was just one of several elements riding along
with it. Fixed by changing the mobile rule to `grid-template-columns:
minmax(0, 1fr)`, removing the auto-minimum so the column actually
respects the viewport width and any wide descendant has to wrap or
scroll within its own box instead of stretching the page. Verified
locally with the same font-substitution simulation used in rounds 1-2
(forcing `'Courier New', monospace` everywhere at 375px): zero overflow.
See the PR for whether this round's CI run confirms it against the real
environment that found the previous two rounds' gaps.

**Why this took three rounds instead of one:** each round's diagnosis was
correct as far as it looked, and each fix was a real, independent bug
worth having fixed regardless -- but reasoning from "the widest single
element" alone (round 1's original diagnostic) systematically
under-diagnoses this exact class of bug, since a forced-wide ancestor
track makes every descendant in it report a similarly-inflated
`getBoundingClientRect()`, and the true cause can be an ancestor several
levels removed from whichever leaf element happens to visually look
"cut off" in a screenshot. The widest-5 diagnostic (added in round 2) is
what actually surfaced the tied-value pattern that pointed at a shared
ancestor rather than another leaf-level flex row.

**Regression coverage:** `e2e/preview-controls.spec.ts` gained a
permanent test using the new `sliver.stl` fixture, so this specific state
(warning banner + narrow viewport) has real, deterministic e2e coverage
going forward instead of relying on incidental model/setting combinations
that may or may not trigger it -- and this test, plus its widest-5
diagnostic, is what actually caught and root-caused all three rounds of
this regression on CI, doing exactly the job it was written for.
`docs/ITERATION_02_PLAN.md`'s §18 item 2 (which originally tracked and
fixed a _different_, already-resolved mobile-overflow bug) is updated
with a closing note pointing here, so this specific question doesn't get
re-litigated a fourth time without new information.
