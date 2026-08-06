# Product Specification — Punch Relief Studio

Tagline: *Turn 3D models into sculptural punch-needle patterns.*

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
2. A quantized **height-level map** (3–8 discrete pile heights).
3. A quantized **yarn-color map** (1–12 colors).
4. A **printable pattern** combining both, plus a legend and scale check.
5. An **interactive simulation** of the textile result built from the same
   quantized data (not from the raw mesh).

## 3. MVP Boundary

In scope: local, client-side, no-account, deterministic pipeline covering
Import → Orient → Relief → Height levels → Color → Preview → Export, three
built-in sample models, a calibration-profile system, PNG/SVG/PDF export,
project persistence via JSON, and a Three.js finished-piece simulation.

Out of scope for MVP: accounts, payments, cloud storage/sync, multi-user
collaboration, generative AI, server-side rendering, multi-view/360° capture,
true undercut/volumetric reconstruction.

## 4. Users & Core Questions

Target user: a punch-needle hobbyist or small-batch maker who has a 3D model
(or wants to try a sample) and wants a pattern they can actually punch. The
product must let them answer, without guessing: which yarn color goes where,
which needle setting goes where, how big the finished piece will be, what the
stepped relief will look like punched, whether the simplified image is still
recognizable, and whether the pattern is printable and followable.

## 5. Explicit Honesty Constraints

- The output is a **front-view bas-relief interpretation** of one visible
  surface, not a full 3D reconstruction. This is stated in the UI, not just
  the docs.
- Height levels are **not** physical millimetres unless the user supplies a
  calibration profile with measured values. Uncalibrated levels are labeled
  "uncalibrated" everywhere they appear (viewport, legend, PDF).
  Yarn-usage estimates are labeled as estimates with stated assumptions.
- Undercuts / occluded geometry are not represented; this is communicated in
  the Orient stage and in docs/LIMITATIONS.md.

## 6. Primary Workflow (7 stages)

Import → Orient → Create Relief → Height Levels → Yarn Colors → Preview →
Export. All settings persist when moving backward/forward. Built-in samples
(ripple, rounded-eye relief, geometric step block) let the full workflow run
without any upload.

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
