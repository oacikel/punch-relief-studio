# Known Limitations

## Product-level (by design)

- **Single-viewpoint bas-relief only.** The pattern captures the nearest
  visible surface from one chosen orthographic viewpoint. Undercuts,
  occluded geometry, and the back/sides of the model are never represented.
  This is communicated in the Import stage's orientation section UI (formerly
  a separate "Orient" stage -- see docs/ITERATION_02_PLAN.md), not only here.
- **Uncalibrated height is not a physical measurement.** Without a
  calibration profile with at least one measured setting, height levels are
  ordered low-to-high only. The app labels this "uncalibrated" everywhere a
  needle setting appears.
- **Yarn-usage estimates are planning estimates**, not purchasing
  guarantees -- see the documented assumptions returned alongside every
  estimate (`docs/ALGORITHMS.md` "Yarn-usage estimate").
- **Punching order is a suggested default**, not a manufacturing rule.

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
