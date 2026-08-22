# Known Limitations

## Product-level (by design)

- **Single-viewpoint bas-relief only.** The pattern captures the nearest
  visible surface from one chosen orthographic viewpoint. Undercuts,
  occluded geometry, and the back/sides of the model are never represented.
  This is communicated in the Import stage's orientation section UI (formerly
  a separate "Orient" stage -- see docs/ITERATION_02_PLAN.md), not only here.
- **Height is never labeled as a physical measurement.** Height levels are
  relative low-to-high bands only. As of Iteration 03 Round 1, no UI
  surface shows needle-setting/measured-height numbers at all -- the
  calibration engine that could compute them still exists
  (`src/domain/calibration.ts`, `CalibrationEditor.tsx`) but has no current
  entry point, by explicit reversible product decision (see
  docs/ITERATION_03_PLAN.md #6 and docs/DECISIONS.md). If that UI returns,
  the "uncalibrated" labeling requirement from CLAUDE.md still applies.
- **Yarn-usage estimates are planning estimates**, not purchasing
  guarantees -- see the documented assumptions returned alongside every
  estimate (`docs/ALGORITHMS.md` "Yarn-usage estimate").
- **Punching order is a suggested default**, not a manufacturing rule.
- **Printed physical scale depends on your printer/OS honoring "100%" /
  "actual size" printing.** The app renders a true-scale SVG and relies on
  the native browser print pipeline (see docs/DECISIONS.md); it cannot
  detect or correct a printer/driver that silently applies "fit to page" or
  its own scaling. This is why every print/PDF output includes a "5cm scale
  check" square (`src/export/svgPattern.ts`) and every relevant helper text
  says to measure it with a ruler before cutting fabric or punching -- this
  is a one-time real-world check no automated test can perform on your
  actual printer. Iteration 02 Stage D verified (headless Chromium,
  print-media emulation, an actual PDF render, and pixel measurement of the
  rasterized output) that the square itself renders at the correct 5cm size
  and is never obscured by the punch-guide dot overlay -- but that only
  proves the _app's output_ is correct, not that any given printer will
  reproduce it at true scale.

## Implementation-level (this MVP build)

- **Simplified edge-preserving smoothing.** `smoothRelief` blends a box blur
  with the original value, reducing (not eliminating) blur across strong
  edges -- not a true bilateral filter.
- **OBJ merge for the 3D preview flattens sub-meshes** into one buffer
  geometry without preserving per-face material assignment for the
  _viewport preview specifically_ (source-material color capture, which is
  what the color pipeline actually uses, samples the rendered scene's real
  materials, not this merged preview mesh).
- **No axe-core automated accessibility run has been executed** in this
  session (no browser available) -- manual semantic/ARIA review only. See
  docs/TEST_REPORT.md for the exact command to run this later.

## Environment-level (not a product decision)

- **Zero commands have been executed against the real dependency tree in
  this session** -- `npm install`, `tsc`, `eslint`, `vitest`, `playwright`,
  and `vite build` have not run, because this sandbox has no outbound
  network access to npm or GitHub (verified: HTTP 403 from the proxy). This
  means undetected type errors, import mistakes, or runtime bugs are a real
  possibility despite careful manual review. See docs/TEST_REPORT.md for
  what to run first in a networked environment, and docs/PLAN_REVIEW.md for
  how this risk was scoped going in.
- **GitHub delivery (push, PR, CI run, merge, tag) has not happened.** Local
  git history is clean and ready to push; see the final delivery report for
  exact next steps.
