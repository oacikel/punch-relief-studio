# Product Specification — Punch Relief Studio

Tagline: _Turn 3D models into sculptural punch-needle patterns._

## 1. Problem

Punch-needle artists work from flat patterns. There is no accessible tool that
converts a 3D model into a punch-needle pattern that also carries **pile
height** (relief) information alongside color, and no tool that lets an
artist preview the finished, textured result before buying yarn.

## 2. Product Analogy

Punch Relief Studio is a "slicer" for punch needle, the way a 3D-printing
slicer turns a mesh into printable layers. Here, the "slices" are:

1. A single **orthographic depth capture** of the model from a chosen
   viewpoint (not the geometry's full volume — see Limitations).
2. A quantized **height-level map** (2–12 discrete pile heights, widened
   from 3–8 in Iteration 02 Stage B -- see `docs/DECISIONS.md`).
3. A quantized **yarn-color map** (1–12 colors).
4. A **printable pattern** combining both, plus a legend and scale check.
5. An **interactive simulation** of the textile result built from the same
   quantized data (not from the raw mesh).

## 3. MVP Boundary

In scope: local, client-side, no-account, deterministic pipeline covering
Import (incl. orientation and model-straightening rotation) → a combined
Workspace (relief generation, height levels, yarn color, preview, and
export all in one persistent view, live-updating as settings change --
see §6), three built-in sample models, a calibration-profile system
(domain/persistence layer only as of Iteration 03 Round 1 -- see below),
PNG/SVG/PDF export, project persistence via JSON, and a Three.js
finished-piece simulation.

Out of scope for MVP: accounts, payments, cloud storage/sync, multi-user
collaboration, generative AI, server-side rendering, multi-view/360° capture,
true undercut/volumetric reconstruction.

## 4. Users & Core Questions

Target user: a punch-needle hobbyist or small-batch maker who has a 3D model
(or wants to try a sample) and wants a pattern they can actually punch. The
product must let them answer, without guessing: which yarn color goes where,
how big the finished piece will be, what the stepped relief will look like
punched, whether the simplified image is still recognizable, and whether the
pattern is printable and followable. (As of Iteration 03 Round 1, "which
needle setting goes where" is not a question the UI answers -- see §6.)

## 5. Explicit Honesty Constraints

- The output is a **front-view bas-relief interpretation** of one visible
  surface, not a full 3D reconstruction. This is stated in the UI, not just
  the docs.
- Height levels are **not** physical millimetres. The app computes a
  calibration mapping internally (per profile, with measured values when
  available -- see §6), but as of Iteration 03 Round 1 no UI surface shows
  needle-setting/measured-height numbers at all; Height Levels and the
  Legend show relative height bands only. If a needle-setting UI returns
  later, uncalibrated levels must still be labeled "uncalibrated" per this
  same constraint. Yarn-usage estimates are labeled as estimates with
  stated assumptions.
- Undercuts / occluded geometry are not represented; this is communicated in
  the orientation section of the Import stage and in docs/LIMITATIONS.md.

## 6. Primary Workflow (2 stages)

**Import → Workspace.** As of Iteration 03's combined-workspace change
(`docs/ITERATION_03_PLAN.md` #13, superseding the former 5-stage wizard --
Import, Create Relief, Height Levels, Yarn Colors, Preview), everything
after Import lives on one persistent Workspace: a scrollable control rail
alongside an always-visible, live-updating preview column, modeled
explicitly on 3D-print slicer software (Cura, PrusaSlicer) rather than a
page-by-page wizard. All settings persist when moving backward/forward
between Import and Workspace. Built-in samples (ripple, rounded-eye
relief, geometric step block) let the full workflow run without any
upload.

Import is unchanged in spirit: pick a sample or drag in a file, then (once
a model has loaded) orient/straighten it via the same orientation section
and Roll/Pitch/Yaw rotation controls as before.

**Workspace's control rail**, top to bottom: **Needle & Pile** (pile-height
count, with a live per-level coverage-percentage readout folded in
directly below it -- previously its own "Height Levels" page), **Punch
Detail** (the "Smallest punchable region" preset, with the small-region
warning directly beneath it), **Shape Interpretation** (relief depth,
smoothing, invert, with the quantization-mode/edge-preservation controls
behind an "Advanced" disclosure), **Yarn Colors** (single/by-height/
source-material mode, the color-story palette gallery, swatch editing --
previously its own page), and **Export & Print** (physical dimensions,
SVG/PNG/print-PDF export, project JSON save/load -- previously a panel at
the bottom of the Preview page, now one more collapsed section in the
rail). There is no manual "Generate relief" button: relief-generation-
affecting settings (pile heights, punch detail, shape interpretation,
model rotation) debounce into an automatic, live regeneration, reflected
by a rail-heading status pill ("● Live — updates as you adjust" / "●
Processing…"). Yarn-color and pattern-display changes update instantly
without any regeneration round-trip.

**Workspace's preview column** (sticky, pinned alongside the rail on wider
screens) shows two panels at once, no tab-switching: **Pattern** (view
mode, grid/mirrored/region-labels toggles, the punch-guide overlay
selector, and the pattern itself) and **Finished-piece simulation** (pile
style, lighting direction, the 3D render in real yarn colors, and the
Roll/Pitch/Yaw model-straightening controls -- also reachable here, not
only from Import, writing to the same underlying rotation value either
place is used from).

As of Iteration 02 Stage C, the Pattern panel's on-screen view gained an
optional punch-guide overlay: a "Punch guide" selector (None/Dots) plus a
"Dot spacing (cm)" control that adds an evenly spaced grid of
placement-guide dots, spaced at a real physical distance the user sets.
The same guide setting drives both the on-screen pattern and every
SVG/PNG/print export -- see `docs/DECISIONS.md` for the full design
rationale and the honesty framing (the dots are the spacing the user
chose, not a measurement of anything the app detected).

As of Iteration 03 Round 1 (see `docs/ITERATION_03_PLAN.md` and
`docs/DECISIONS.md`):

- Needle-setting/calibration UI is removed app-wide, by explicit,
  reversible product decision -- there is currently no "Calibrate needle
  settings" link, no needle-setting column anywhere, and no Calibration
  section in Export & print. The Needle & Pile group and the Legend show
  relative height bands/regions only. The underlying calibration domain
  code and editor component are untouched and can be re-surfaced later;
  see `docs/DECISIONS.md`'s "Calibration/needle-setting UI removed, not
  deleted" entry for exactly what stayed wired.
- The "Smallest punchable region" control is three named presets (Fine
  detail / Balanced / Bold & simple) instead of a raw pixel number, and
  "Detail resolution" is removed entirely (hardcoded at 256px) rather
  than merely hidden under Advanced -- see `docs/DECISIONS.md`.
- The Import stage's 3D viewport gained model-straightening rotation
  (Roll/Pitch/Yaw sliders + reset), alongside the existing standard-view
  buttons, for models that don't land upright on import.
- The Pattern panel's on-screen view controls (view mode, grid, mirrored,
  region labels, punch guide) are the _only_ copy of those controls --
  Export & print previously had its own independent "Export pattern view"
  selector and "Print region labels" checkbox (added in Stage C); both
  are removed and export/print now reads whatever the Pattern panel is
  currently showing on screen. See `docs/DECISIONS.md` for the reversal
  note.
- Yarn Colors gained a small "Color story palettes" gallery (four
  hand-picked, bundled collections) that fills color-by-height swatches
  in one click, still hand-editable afterward.

## 7. Non-Functional Requirements

Entirely client-side (static site, no backend), deterministic given the same
input + settings (stable seeds where randomness would otherwise occur),
privacy-preserving (no network calls for model/texture data, no analytics),
responsive down to a documented minimum viewport, and resilient to malformed
input (never crash to a blank page).

See docs/ARCHITECTURE.md for module boundaries, docs/ALGORITHMS.md for the
processing pipeline in detail, docs/LIMITATIONS.md for what is intentionally
not solved in this MVP, and docs/ACCEPTANCE_MATRIX.md for how each
requirement above is verified.
