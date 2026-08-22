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
