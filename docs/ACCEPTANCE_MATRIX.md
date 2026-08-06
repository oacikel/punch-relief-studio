# Acceptance Matrix

Status legend: **Built** = code exists implementing the requirement.
**Verified** = a captured command/output or screenshot confirms it in this
session. **Deferred-verify** = built but verification requires `npm install`
+ a real browser, which this sandbox cannot do (see PLAN.md); the exact
command to run is given. Nothing is marked Verified without evidence in
docs/TEST_REPORT.md.

| # | Requirement | Status | Verification method |
|---|---|---|---|
| 1 | Load STL (binary/ASCII) and OBJ(+MTL) | Built | `src/domain/import/*.test.ts`; `npm run build` + manual import — Deferred-verify |
| 2 | Drag-drop + file picker, validation, errors | Built | `ImportStage` component tests — Deferred-verify (RTL needs deps) |
| 3 | Auto center/scale/camera-fit, bounds indicator, reset view | Built | `viewport.ts` unit tests for math; visual — Deferred-verify |
| 4 | No remote asset fetching from OBJ/MTL | Built | `objLoader.ts` only resolves from supplied `FileList`; unit test asserts remote paths are rejected |
| 5 | 3 built-in samples (ripple, rounded relief, geometric) | Built | `src/domain/samples/*.ts` generate geometry deterministically; unit tests check vertex counts/bounds |
| 6 | Orthographic projection for pattern gen; nearest-surface only | Built | `depthCapture.ts`; math-level unit test on a synthetic depth buffer |
| 7 | Depth→mask→normalize→invert→intensity→smooth→quantize→cleanup pipeline | Built | `relief.ts`, `quantize.ts`, `regionCleanup.ts` unit tests |
| 8 | 3–8 height levels, equal-interval + quantile modes, deterministic | Built | `quantize.test.ts` — boundary + determinism cases |
| 9 | Tiny-region cleanup, connected components | Built | `regionCleanup.test.ts` |
| 10 | Calibration profiles (CRUD, default uncalibrated, JSON import/export, localStorage) | Built | `calibration.test.ts` + `calibrationStore.test.ts` |
| 11 | Calibration-strip generator | Built | `calibrationStrip.ts` SVG output test (dimensions, block count) |
| 12 | Color modes: single / by-height / source-material | Built | `colorMode.ts`, `colorQuantize.ts` tests |
| 13 | Deterministic color quantization, small-island merge, swatch edit/name | Built | `colorQuantize.test.ts` (stable seed, repeat-run equality) |
| 14 | Combined `C{n}-H{n}` region identity, non-color-only reading | Built | `regionId.test.ts`; pattern renders symbols per level |
| 15 | Pattern workspace: dims, lock aspect, views, grid, labels/leader lines, legend, scale, registration marks, margins, small-region warning | Built | `pattern/*.test.ts` + `PatternCanvas` — Deferred-verify visual |
| 16 | Yarn usage estimate w/ documented assumptions | Built | `yarnEstimate.test.ts` |
| 17 | Punching-order suggestion (documented as a default, not a rule) | Built | `punchOrder.test.ts` |
| 18 | Finished-piece simulation from quantized data (not raw mesh) | Built | `simulation/buildReliefMesh.ts` consumes `HeightRegionMap`, unit test on displacement values |
| 19 | Simulation controls: lighting, density, thickness, loop/cut preset, fabric color, comparison views, reset | Built | `SimulationStage` component — Deferred-verify visual |
| 20 | Exports: PNG, SVG, print-PDF, sim PNG, project JSON, calibration JSON | Built | `export/*.test.ts` for SVG dimension/scale metadata + filename sanitization; PDF via browser print — Deferred-verify |
| 21 | Print PDF: A4/Letter/actual size, tiling, overlap, crop marks, page numbers | Built | `printTiling.test.ts` — math verified without a browser |
| 22 | Project JSON schema + version + clean failure on future versions | Built | `projectSchema.test.ts` |
| 23 | Unit conversion (cm/in/model units/px) correctness | Built | `units.test.ts` |
| 24 | Error handling: malformed files, empty geometry, no foreground pixels, WebGL init failure, export failure, storage quota, invalid JSON | Built | targeted unit tests + `ErrorBoundary` component — Deferred-verify integration |
| 25 | Accessibility: keyboard nav, focus, labels, contrast, reduced motion, color-independent reading | Built | semantic HTML/ARIA in components; axe run — Deferred-verify (needs browser) |
| 26 | Playwright E2E 10-step workflow + import fixture | Built | `e2e/main-workflow.spec.ts`, `e2e/import-fixture.spec.ts` — Deferred-verify (needs `npx playwright test`) |
| 27 | Production build succeeds | Not run | `npm run build` — Deferred-verify, command documented |
| 28 | CI (lint, typecheck, unit, build) on GitHub Actions | Built | `.github/workflows/ci.yml` — Deferred-verify (needs GitHub push) |
| 29 | Git history, GitHub repo, PR, CI green, merge, tag v0.1.0 | Partial | Local git history built; GitHub push/PR/merge/tag blocked by sandbox network — see final report |

Any row that stays Deferred-verify at delivery time is repeated, with the
exact command and expected result, in `docs/TEST_REPORT.md`.
