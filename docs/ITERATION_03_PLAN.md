# Iteration 03 — Direct-Manipulation & Simplification Pass

Status: **draft, not yet approved for implementation.** Written in response to
the product owner's hands-on testing feedback on the deployed Iteration 02
(Stages A–D) build, delivered as 13 numbered points. Every point below was
checked against the actual code before a direction was proposed — this is
not a wishlist restated, it's a triaged plan. Iteration 02's own Stage E
(the open-ended "polish" survey) is superseded by this document; see
`docs/ITERATION_02_PLAN.md` for that survey's findings, several of which
overlap with points below (noted inline).

## How to read this

For each point: what was reported → what the code actually does → verdict
(confirmed bug / agree / partial agreement with pushback / needs
clarification) → proposed direction → rough size. Then a proposed
sequencing that separates independently-safe bug fixes from the one item
that's a real design decision requiring explicit sign-off before
implementation starts.

---

## 1. "Smallest punchable region" has no units

**Verdict: agree, confirmed.**

Currently a raw-pixel value (`ReliefStage.tsx`), a computation-space unit
with no meaning to a crafter. Stage C already established a precedent for
exactly this kind of conversion — the punch-guide dot spacing is expressed
in cm via `src/domain/units.ts`'s named `cm`/`cmToPx` functions, using the
pattern's already-known physical Width/Height. Same pattern applies here:
express the control in cm (or mm), convert to px internally at generation
time.

**Size: small–medium.**

> **RESOLVED (product owner review, superseding the above).** The cm-based
> proposal above has a real sequencing problem: "smallest punchable
> region" is applied during relief generation, in the Worker via
> `cleanupTinyRegions`, which runs _before_ the app ever asks for a
> physical Width/Height (that only exists later, on the Export panel) —
> so a cm value has no physical scale to convert against at the point
> it's actually used. **Corrected direction: don't use physical units at
> all.** Replace the raw pixel number input with a small set of
> descriptive presets ("Fine detail" / "Balanced" / "Bold & simple"),
> each mapped internally to a threshold expressed as a _percentage of the
> canvas area_ (not a fixed px count), so it stays meaningful regardless
> of raster resolution. This fully resolves the original complaint
> without needing physical scale. The "Balanced" preset reproduces
> today's effective default. See `src/domain/pattern/minRegionPreset.ts`
> and `docs/DECISIONS.md` for the implemented percentages. Shipped in
> Iteration 03 Round 1.

## 2. "Detail resolution" is an arbitrary parameter non-technical users shouldn't have to tweak

**Verdict: partial agreement, with pushback — and a clarifying question.**

Two things are bundled in the original note:

**(a) Should resolution be tied to physical loop/stitch size?** This was
already explicitly considered and rejected during Stage B's planning.
`docs/ITERATION_02_PLAN.md`'s Relief-stage audit table says of this exact
control: _"conflating this with physical loop density would be dishonest,
per CLAUDE.md's units discipline."_ Resolution is a sampling-density knob —
how many raster samples the depth capture takes — not a physical scale.
There's no honest fixed conversion between "256px raster" and "yarn loop
spacing," because that depends on how large the pattern is eventually
printed. Tying them would be the same kind of fabricated-measurement
dishonesty CLAUDE.md already warns against elsewhere. Standing by the
original call here.

**(b) Should it be hidden from non-technical users by default?** Already
done — Stage B put "Detail resolution" behind the "Advanced punch detail
controls" disclosure, not the Basic tier shown by default.

**Clarifying question:** if you're still running into this as a default-
visible "arbitrary knob," it may be residual impression from before Stage
B shipped, or you opened the Advanced disclosure out of curiosity. If it's
still bothering you with the disclosure collapsed, say what specifically
still reads as arbitrary — the label, the fact it exists at all, something
else — so the fix targets the real problem.

This point, #4, and #6 all point at the same underlying diagnosis: the app
currently shows every control to every user, when there are really at
least two personas — fixed-detent-needle punchers who want real
calibrated numbers, and adjustable-needle punchers (like you) who just
want relative height bands. See the sequencing note below — recommend
folding this into one global Simple/Advanced framing rather than three
separate one-off fixes.

> **RESOLVED (product owner review, superseding the above).** Explicit
> product decision: **remove "Detail resolution" as a user-facing control
> entirely**, rather than continuing to hide it under Advanced. The
> "Advanced punch detail controls" disclosure is deleted outright (it
> contained no other field). The value is hardcoded at 256px longest-edge
> — the removed control's own documentation already called this "a
> sensible default that covers most cases" (point (a) above stands: this
> is a sampling-density constant, not a physical measurement, so hardcoding
> it doesn't violate the units-discipline concern in (a)). The
> `ReliefSettings.outputResolutionPx` field itself stays in the type/
> schema for backward compatibility with old project files; it's simply
> no longer writable from the UI. Shipped in Iteration 03 Round 1.

## 3. Nice-to-have: sliders should visually preview effect via a 2D curve

**Verdict: agree — probably the single highest-leverage idea on this list.**

This is the "direct manipulation" interaction principle (Shneiderman) —
see something respond immediately to a control, rather than inferring the
effect from a number. Concretely: a live 2D height-profile curve (a
cross-section line graph — position across the model on x, normalized
height on y) that updates as relief-depth/smoothing/edge-preservation/
quantization-mode/invert move — one shared live widget reacting to all of
them together, per the follow-up note ("all the parameters on this page
should be adding to this"), not one graph per slider.

**This is naturally satisfied by #13's live preview pane, not a separate
build.** If the combined workspace happens, #3 becomes "what that pane
shows for Relief-stage controls," not its own feature. Recommend folding
this into #13's design rather than building a standalone widget first.

**Size: medium–large, tied to #13.**

**Status: out of scope for Iteration 03 Round 1** — held with #13, per the
product owner (no reversal here; still needs its own sign-off before any
code is written).

## 4. "Generate relief" button is hard to reach (bottom of a long column)

**Verdict: confirmed** — traced the JSX; it's the last element after three
control groups and two Advanced disclosures, which can put it well below
the fold.

You flagged this as part of a bigger UX point you'd come back to — noting
here that it's symptomatic of the same root cause as #13 (a long, linear
per-stage control column). If the combined workspace happens, the real
fix is likely debounced live regeneration with no manual "Generate
relief" button at all (see #13) — which resolves this for free rather
than needing a sticky-button patch that becomes dead weight later.

**Recommend holding for #13.**

**Status: out of scope for Iteration 03 Round 1**, per the product owner —
held with #13.

## 5. 3D views should have a rotate function

**Verdict: needs clarification — the code says this should already work.**

Checked both 3D views: `Viewport3D.tsx` (Import/Relief) and
`SimulationView.tsx` (Preview's Finished-piece simulation). Both already
instantiate Three.js `OrbitControls` with damping enabled, which supports
click-and-drag rotate out of the box.

Possible explanations if it didn't feel that way: (a) drag conflicted with
something else (trackpad scroll-to-zoom feeling unresponsive, mistaken for
rotate not working), (b) there's genuinely no visual affordance telling you
it's draggable — no cursor hint, no "drag to rotate" label — easy to miss
on a first encounter, (c) something specific broke that hasn't been
reproduced yet.

**Before building anything here: which view felt static, and did
click-and-drag do nothing, or did something feel wrong?** Don't want to
build a redundant control if the real issue is discoverability, which
would be a much smaller fix (a label, a cursor affordance).

> **RESOLVED (product owner review, superseding the above).** Clarified
> with a screenshot: camera orbit/pan/zoom via `OrbitControls` was
> confirmed already working correctly — that was never the gap. The real
> gap is that **some imported models aren't aligned to their "natural"
> orientation on import**, and standard `OrbitControls` deliberately
> preserves world-up, so it can orbit azimuth/elevation freely but can
> never _roll_ the view to compensate for a model that's tilted/rotated
> around its own axis relative to what "upright" should look like (the
> screenshot showed a relief rendered at a skewed diagonal angle).
> **Corrected direction: build real model-rotation controls** — rotate
> the imported model/geometry itself (not just the camera) around Roll/
> Pitch/Yaw, exposed on the Import stage's orientation section alongside
> the existing standard-view buttons and the shared `Viewport3D`. See
> `docs/DECISIONS.md` for the chosen implementation approach (Object3D
> transform + local component state, mirroring how the existing
> standard-view camera state already persists across Import ↔ Relief).
> Shipped in Iteration 03 Round 1.

## 6. Let go of the needle-setting mapping/measurement, at least for now

**Verdict: agree in spirit, with a scoped proposal rather than deleting the feature.**

Deleting it outright would break calibration for anyone using fixed-detent
needles who does rely on measured settings — the app already supports
both personas today via its default "uncalibrated" state. Proposal:
**make needle-setting framing opt-in rather than default-on**, not remove
it.

- Heights stage's table currently always shows a "Needle setting" column
  ("1: low (uncalibrated)," etc.) — default this off, or relabel to
  something instrument-agnostic like "relative order" for everyone, with
  "needle setting N" language appearing only once a real calibration
  profile is in active use.
- Fold into the same Simple/Advanced global framing as #2 — one toggle,
  not a per-page fix.
- Practically: for an adjustable-needle crafter, the app should mostly
  talk about height levels/bands (the real punchable information it
  already computes), surfacing "needle setting N" only once you've told it
  you have a fixed-detent tool.

`mapHeightLevelToSetting` and the calibration domain logic stay exactly as
they are — this is a presentation-layer default change, not an
architecture change.

**Size: medium** (mostly copy/default-visibility work, small logic for the
opt-in toggle).

> **RESOLVED (product owner review, superseding the above).** Not
> "opt-in/toggle" — explicit product decision to make needle-setting/
> calibration **fully inaccessible from the UI, for now** (a reversible
> decision, not a deletion of the feature). Concretely: the "Needle
> setting" column is removed from Height Levels' table (plain height
> bands only), the "Needle setting"/"Measured height" columns are removed
> from Preview's Legend (Region/Symbol/Yarn color/Yarn name stay — the
> C{n}-H{n} symbol pairing is unrelated to calibration and stays per
> CLAUDE.md's "never rely on color alone" rule), the "Calibrate needle
> settings" link is removed from Height Levels, and the entire Calibration
> section is removed from the Export panel. The underlying domain code
> (`src/domain/calibration.ts`), `CalibrationEditor.tsx`, and their tests
> are explicitly **not deleted** — this is a UI-surface removal, not
> defunct code, since it's expected to return. See `docs/DECISIONS.md`
> for the precise list of what was removed from the render tree vs. what
> was deliberately kept wired in `state/appState.ts`/`App.tsx`. Shipped in
> Iteration 03 Round 1.

## 7. Yarn colors: pre-built swatch/color-story palettes (Terrain, Sea, etc.)

**Verdict: agree, no pushback.**

Precedent: paint-brand color-story collections, Adobe Color/Coolors
curated palettes, yarn-shop "color family" listings. Proposal: alongside
the existing per-region color pickers, add a small palette gallery (a
handful of named, hand-picked collections) applicable in one click to
color-by-height regions, with individual swatches still hand-editable
afterward. Palette data stays local/bundled — no network calls, per
CLAUDE.md.

**Size: medium, self-contained** — doesn't depend on or block anything
else here. Good candidate to ship independently of the bigger questions.

**Status: implemented as proposed in Iteration 03 Round 1** — see
`src/domain/color/palettes.ts` and `docs/DECISIONS.md`.

## 8. Lighting-direction slider resets your camera orientation on Preview

**Verdict: confirmed and root-caused.**

`SimulationView.tsx` has a single `useEffect` that rebuilds the _entire_
scene — camera, `OrbitControls`, mesh, everything — whenever
`RenderSettings` changes as one object. `RenderSettings` bundles
`pileStyle`/`fabricColorHex`/`lightingAzimuthDeg`/`lightingElevationDeg`
together, so moving the lighting slider triggers a full scene
teardown-and-rebuild, discarding whatever camera position you'd set.

**Fix:** split the effect the way `Viewport3D.tsx` already does elsewhere
in this codebase — one effect that builds scene/camera/controls/mesh when
geometry-affecting props change, a separate lighter effect that only
updates light angle and material properties without touching camera
state.

**Size: small, self-contained, no design decision needed.**

**Status: implemented as proposed in Iteration 03 Round 1.**

## 9. Background ("black void") is rendered as a real layer

**Verdict: confirmed real bug, root-caused precisely.**

The depth-capture and quantization pipeline already correctly excludes
background pixels — `quantize()` in `src/domain/quantize.ts` leaves
`heightIndex = -1` for anything outside the foreground mask, and the 2D
SVG pattern renderer (`src/export/svgPattern.ts`) already correctly skips
`h === -1` everywhere it appears. The bug is isolated to the 3D
"Finished-piece simulation" mesh builder:

```
src/three/buildReliefMesh.ts:52
const y = h === -1 ? 0 : heightForLevel(h, options.levels, options.profile, step);
```

Background pixels get flattened to height 0 and built as solid geometry,
instead of being excluded from the mesh. This is exactly why a sphere
renders as "a cylinder with a half-sphere on top" (point 12) — the entire
rectangular canvas becomes a solid zero-height slab fused to the actual
object.

**Pushback on "optional at best, disabled at worst":** there's no
legitimate case for rendering background as solid material — it's simply
wrong, not a matter of taste. Recommend fixing it outright (exclude
background from the mesh entirely — a real gap, or clip to the foreground
silhouette) rather than adding a settings toggle for something that should
just always be correct.

**Size: small–medium**, contained to `src/three/buildReliefMesh.ts`;
doesn't touch the domain layer or the already-correct 2D pattern path.

**Status: implemented as proposed in Iteration 03 Round 1.**

## 10. Yarn color isn't visible in the Preview simulation — always brown

**Verdict: confirmed, root-caused.**

`SimulationView.tsx` hardcodes `color: 0xb5563c` (flat brown) on the
entire mesh material, ignoring the per-region yarn colors assigned on the
Yarn Colors stage entirely. Notably, the component's own `Props` interface
already declares `swatchColorsByHeight?: string[] // for color-by-height
fallback shading` — documented intent that was never wired up.

This is the highest-priority concrete bug on the list after #9 — the
entire point of "Finished-piece simulation" is previewing what you're
about to make, and right now it can't show color at all.

**Fix:** build a per-region-colored mesh from the actual assigned yarn
colors (matching whichever color mode — by height or by region — is
active), reusing the same region→color mapping the 2D pattern and Legend
already use. Touches `buildReliefMesh.ts`'s geometry generation (carry
region/height index per face) and `SimulationView.tsx`'s material setup.

**Size: medium**, no design decision needed — straightforwardly correct.

**Status: implemented as proposed in Iteration 03 Round 1** — via a
per-vertex color attribute driven by the same `LegendEntry[]` the 2D
pattern and Legend already consume; see `docs/DECISIONS.md`.

## 11. Export & print duplicates controls already on the Preview page

**Verdict: confirmed, agree with the instinct — flagging a partial reversal
of a Stage C decision.**

Preview's top controls (pattern view, Grid/Mirrored/Region labels, punch
guide) and the Export & print panel (pattern view again, "Print region
labels" again) are two independent, parallel control sets — a deliberate
Stage C call that screen and print settings could diverge, documented in
`docs/DECISIONS.md`. In practice this reads as redundant rather than
powerful.

**Proposed fix:** default Export/print to mirror whatever's currently
shown on screen (view mode, labels, grid, punch guide) instead of
requiring separate selection, keeping an explicit override only if a real
need for divergence shows up. This is a genuine, if partial, reversal of
Stage C's original design call — flagged explicitly rather than silently
changed.

**Size: small–medium.**

> **RESOLVED (product owner review, superseding the above).** Not
> "default to on-screen settings with an override" — explicit product
> decision to **remove the duplicate controls outright**. `ExportPanel`'s
> own "Export pattern view" selector and "Print region labels" checkbox
> are deleted; the print/export path now reads directly from whatever
> `PatternViewSettings`/on-screen state Preview is currently showing
> (view mode, grid, mirrored, region labels, punch guide). There is
> exactly one set of these controls in the UI, not two. This is a full
> reversal of the Stage C decision recorded in `docs/DECISIONS.md` — see
> that file's Iteration 03 Round 1 entry for the explicit reversal note.
> Shipped in Iteration 03 Round 1.

## 12. "Shave the bottom" — held per your own note, pending #9

**Verdict: agree with your own diagnosis.** Once #9 ships (background
genuinely excluded from the mesh, not flattened to height 0), a
sphere-shaped model should stop generating a false base slab — there's no
longer a "floor" fused to it. Recommend genuinely holding this: try the
result after #9 ships, and if the piece still isn't right — e.g. you want
to remove the _lowest real height band_, not just true background — that's
a smaller, distinct follow-up ("treat height-band 1 as void" toggle)
worth scoping then, once it's clear it's still needed.

**Status:** #9 shipped in Iteration 03 Round 1 — genuinely held per the
above, pending the product owner trying the result.

## 13. Combine Create relief / Yarn colors / Preview into one workspace

**Verdict: agree it's the right direction — and the one item here that
needs your explicit sign-off before any code gets written.**

What's being described — adjust a parameter, immediately see the real
effect on the finished pattern, no multi-page round-trip — is the exact
interaction model 3D-print slicer software (Cura, PrusaSlicer, OrcaSlicer)
already uses for a structurally similar problem: turning a 3D model into a
physical fabrication plan through a chain of parameterized transforms.
Worth deliberately borrowing rather than reinventing:

- **PrusaSlicer**: a persistent 3D view occupies most of the screen; a side
  panel selects profiles and settings; a Simple/Advanced/Expert mode
  toggle hides complexity by default rather than removing it.
- **Cura**: "Prepare" and "Preview" tabs keep settings and a live model
  view together in one window rather than as separate wizard pages.

Concrete direction, open for discussion:

- One workspace layout: a persistent live preview pane (pattern view and
  finished-piece simulation, possibly as a view-mode switch rather than
  fully separate panels) alongside a control rail using the same
  Basic/Advanced grouping Stage B already built for Relief, extended to
  cover Height levels and Yarn colors as more sections in the same rail —
  not separate wizard stages.
- Debounced live regeneration on setting change, no manual "Generate
  relief" button at all (see #13) — resolves #4 for free. Worth checking
  the relief pipeline's real performance budget first (it already runs
  off the main thread in a Web Worker per CLAUDE.md's architecture, a
  genuinely good sign for live-on-change) before committing to fully live
  updates on every keystroke.
- Import stays a separate first step — a model is a real prerequisite for
  everything else. Export folds into the workspace too, which addresses
  #11 at the same time. Net effect: today's 5 stages could become
  something like 2 (Import → Workspace).
- This is a genuinely large restructure — bigger than any single stage in
  Iteration 02 — touching `src/state/workflow.ts`, most of
  `src/components/stages/**`, and likely a new top-level layout component.

**Not pushing back on the idea** — it's the right instinct, and it ties
#3, #4, and #11 together for free. Flagging that, of everything on this
list, this is the one item that should get a real plan doc, an independent
pre-implementation review, and (ideally) a rough layout look before it
becomes engineering work — the same rigor Iteration 02's stages ran on,
not something scoped casually in a feedback response.

**Status: out of scope for Iteration 03 Round 1**, per the product owner —
explicitly held for its own future sign-off. #11 (its former dependent) was
independently resolved and shipped in Round 1 (see above); #3/#4 remain
tied to this item and stay open.

> **RESOLVED — shipped as the combined-workspace change** (this is the
> largest single change of the engagement; given its own explicit sign-off
> and a dedicated plan/review process, per the note above). The 5-stage
> wizard (Import, Create relief, Height levels, Yarn colors, Preview)
> collapses to 2 stages: **Import** (unchanged — a model is a real
> prerequisite for everything else) and **Workspace**, a persistent
> control rail (left) alongside a sticky, always-visible preview column
> (right) with two stacked panels — Pattern and Finished-piece simulation
> — both visible at once, no tab-switching. `WORKFLOW_STAGES` is now
> `['import', 'workspace']`. This fully absorbs #3 (a live 2D height-
> profile curve becomes unnecessary — the whole workspace _is_ the live
> preview now) and #4 (no "Generate relief" button exists anymore to be
> hard to reach).
>
> **Rail structure**: "Needle & pile" (pile-heights slider, plus a live
> H1/H2/... coverage-percentage chip row folded in from the former Height
> Levels stage — it was really just live feedback for that one slider, not
> its own destination), "Punch detail" (min-region preset, plus the former
> Height Levels stage's small-region warning, moved here since it's driven
> by this group's own preset control — cause and effect stay visually
> adjacent), "Shape interpretation", "Yarn colors" (the former Yarn Colors
> stage's content verbatim), and "Export & print" (the existing compact
> `ExportPanel`, simply relocated into the rail as one more collapsed
> section rather than living at the bottom of a separate Preview page).
>
> **Live regeneration replaces the manual "Generate relief" button.**
> `src/hooks/useLiveRelief.ts` debounces relief-generation-affecting
> setting changes (pile heights, min-region preset, relief depth,
> smoothing, invert, quantization mode, edge preservation, model rotation)
> by 300ms, then runs the existing capture→worker pipeline unchanged.
> Yarn-color/palette/view-mode/grid/label/pile-style/lighting changes
> stay purely client-side (no worker round-trip) — the same distinction
> the original brief asked for. A monotonic generation counter (bumped
> synchronously the instant a newer trigger is observed, not just at
> completion) discards a slower, superseded in-flight result rather than
> letting it overwrite a newer one — chosen over `AbortController`-style
> cancellation since the single long-lived Worker this app already uses
> per CLAUDE.md's worker-based-processing decision has no real
> cancellation primitive to begin with. The rail heading's live-status
> pill ("● Live — updates as you adjust" / "● Processing…") reflects real
> `AppState.processing` state, not a static label. See docs/DECISIONS.md
> for the debounce-interval profiling, the full algorithm, and its test
> coverage (including a dedicated test for the out-of-order-completion
> race this design exists to prevent).
>
> **The rotation-panel wrinkle**: the product owner asked for the
> Roll/Pitch/Yaw model-straightening controls (Round 1, #5) to be
> reachable from the new Finished-piece simulation panel rather than only
> from the separate Import step — genuinely non-trivial, since that
> control lived as local state inside `Viewport3D.tsx` (the _raw-model_
> viewport `capture()` reads from), while the simulation panel renders a
> _different_ component (`SimulationView.tsx`, built from the _processed_
> region map) with no rotation awareness at all. Resolved by lifting
> rotation into `AppState.modelRotationDeg`, extracting the slider UI into
> a shared `RotationControls` component rendered in both places (Import's
> `Viewport3D`, and Workspace's new `SimulationPanel`) bound to the same
> value, and keeping `Viewport3D` mounted-but-visually-hidden during
> Workspace so `capture()` keeps working from wherever the user actually
> adjusts rotation. `SimulationView`'s real yarn-colored/pile-textured
> render stays what's shown — no fallback to the raw-model view. Full
> reasoning, the rejected alternative, and the accessibility handling for
> the hidden `Viewport3D` instance are in docs/DECISIONS.md.
>
> **Process**: implementation plan drafted, reviewed by an independent
> fresh-context agent before any code was written (findings: four
> concrete gaps, all fixed — `view`/`showGrid`/`mirrored` state lifted to
> `Workspace.tsx` so `ExportPanel` could read it, `ExportPanel` given the
> same not-ready-yet placeholder gate as the preview panels, stale
> "Generate relief"-referencing copy reworded, and a stale e2e assertion
> plan corrected). Implementation verified against a real running browser
> (both wrinkles confirmed working end-to-end, not just unit-tested) before
> the e2e suite was updated. A second independent fresh-context review of
> the finished diff found zero blocking issues. Full local gate
> (format/lint/typecheck/test/build) and the full Playwright e2e suite —
> chromium and mobile-narrow (WebKit) — are green; see docs/TEST_REPORT.md.
>
> **What changed structurally, in one line**: 5 stage components
> (`ReliefStage`/`HeightStage`/`ColorStage`/`PreviewStage.tsx`) are deleted
> and their content redistributed into `src/components/workspace/`
> (`Workspace`/`ReliefControls`/`YarnColorsGroup`/`PatternPanel`/
> `SimulationPanel.tsx`) plus a new shared `src/components/
RotationControls.tsx` and `src/hooks/useLiveRelief.ts`; `ImportStage.tsx`
> is unchanged apart from its "Continue to..." button text.

---

## Proposed sequencing

This list mixes independently-safe bug fixes, small self-contained
features, one open clarification, and one large restructure. Recommend
**not** treating this as one big "Stage E," and instead:

### Round 1 — confirmed, isolated bugs (small, safe, no pending decisions)

- #9 — background rendered as solid geometry (`buildReliefMesh.ts`)
- #10 — yarn color missing from the simulation (`SimulationView.tsx` +
  `buildReliefMesh.ts`)
- #8 — lighting slider resets camera orientation (`SimulationView.tsx`
  effect split)
- #1 — units on "Smallest punchable region"

These four are correct regardless of what happens with #13 — #9 and #10 in
particular actively break the Preview stage's core promise (show what
you're about to make) right now.

### Round 2 — small, self-contained features

- #7 — yarn color-story palettes
- #11 — export/print defaults to on-screen settings (partial reversal of a
  Stage C call, flagged above)

### Needs your input before proceeding

- #5 — what specifically felt static (code suggests rotate should already
  work)
- #2 — confirm whether "Detail resolution" still bothers you now that it's
  Advanced-tier-hidden, or if the concern is something else
- #13, and by extension #3/#4/#6 (folded into it) — the Simple/Advanced
  global framing and the combined-workspace redesign — the real design
  conversation, needs explicit sign-off before implementation

> **Round 1 outcome note.** The product owner's review (recorded inline
> above at points #1, #2, #5, #6, #11) resolved five of the "needs your
> input" items with concrete corrected directions rather than confirming
> the original proposals, and folded #7 and #11 into Round 1 alongside the
> original four bug fixes — so "Round 1," as actually implemented, ended
> up covering points #1, #2, #5, #6, #7, #8, #9, #10, #11 (nine items
> total; #3, #4, and #13 stayed explicitly out of scope, per the product
> owner). See `docs/DECISIONS.md` for the implementation decisions behind
> each resolved point, and each point's own "RESOLVED"/"Status" note above
> for what changed from the original proposal.

> **Combined-workspace outcome note.** #13 (and, by absorption, #3 and #4)
> shipped after its own dedicated plan doc, independent pre-implementation
> review, and independent post-implementation diff review, per the process
> this section called for. See point #13's own "RESOLVED" note above for
> the full account of what was built and how both architectural wrinkles
> (rotation-panel placement, live-regeneration correctness) were resolved.

> **Post-ship usability audit (branch `feat/workspace-usability-fixes`).**
> A separate, hands-on audit of the shipped combined-Workspace redesign,
> using a real 74MB STL file, found five concrete follow-up bugs/gaps: the
> sticky preview column not pinning in the default/light state (a CSS
> grid row-sizing edge case the original sticky-preview implementation
> didn't anticipate), the Import stage's 3D orient viewport rendering
> below the fold, no "you are here" cue in a rail that can grow to ~2.5x a
> 900px viewport, "Export & print" buried after every color swatch, and a
> third report of mobile-width overflow (this one requiring the
> small-region warning banner to be actively showing, and ultimately not
> reproducing once that precondition was correctly isolated). All five
> fixed following this same document's own process (draft plan,
> independent pre-implementation review, implementation, independent
> post-implementation diff review). See `docs/DECISIONS.md`'s "Workspace
> usability fixes" section for the full root-cause analysis and chosen
> fix for each.

## Cross-reference: Iteration 02's own Stage E survey

`docs/ITERATION_02_PLAN.md`'s Stage E audit (run before this feedback
arrived) independently found two items that overlap with this list:
Preview's mobile-narrow layout overflow (unrelated to points above — a
separate, already-scoped bug, still worth fixing in Round 1) and the
camera-framing issue for flat/wide models (which the product owner
separately reconfirmed above: "not every model is placed correctly by
default when uploaded"). Both remain open, tracked there.
