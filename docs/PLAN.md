# Implementation Plan — Punch Relief Studio

## Environment constraint (read first)

This build is being produced inside a sandboxed execution environment with
**no outbound network access** to the npm registry or GitHub (verified: both
return HTTP 403 at the proxy regardless of credentials; no GitHub MCP
connector is available; the account is a Pro plan with no network-capability
toggle). This means dependency installation, `tsc`/`vite`/`vitest`/
`playwright` execution, and git push/PR/CI runs **cannot happen in this
session**. The plan and all later phases are adapted accordingly:

- Every source file is still written for real, targeting the exact dependency
  versions pinned in `package.json`, so that `npm install && npm run build`
  succeeds in a normal environment.
- Verification that would normally run a tool is instead recorded as
  **not executed in this session** in `docs/TEST_REPORT.md`, with the exact
  command the user (or a future networked session) should run and what
  result to expect. No test is described as "passing" without a captured
  exit code and output from an actual run.
- GitHub delivery (repo creation, push, PR, CI, merge, tag) is prepared
  (clean local git history, CI workflow file, PR description drafted) but the
  network actions themselves are deferred and reported as blocked.

## Tech stack

React 18 + TypeScript (strict) + Vite 5 + Three.js (r160+) + vanilla Three.js
(no React Three Fiber — the scene graph here is small and imperative,
R3F would add a dependency without simplifying it) + Vitest + React Testing
Library + Playwright + ESLint + Prettier + GitHub Actions. Package manager:
npm (workspace had no existing lockfile or convention). Node: pinned via
`.nvmrc` to the LTS available in this environment (22.x).

## Milestones

1. **Foundation** — strict TS config, ESLint/Prettier, Vitest/Playwright
   config, CI workflow, CLAUDE.md, LICENSE (MIT), .gitignore. Commit.
2. **Vertical slice** — ripple sample → fixed ortho depth capture → 4 height
   levels → 1 yarn color → pattern view → displaced-plane simulation → PNG/SVG
   export. Proves the same quantized data drives both the pattern and the
   simulation. Commit.
3. **Import & orientation** — STL (binary+ASCII) and OBJ(+MTL) loaders, local
   multi-file drag/drop, validation, size limits, camera fit, standard views,
   ortho/perspective toggle, projection-direction picker, relief crop.
   Commit.
4. **Full processing pipeline** — resolution, levels (3–8), intensity,
   inversion, smoothing, edge preservation, min-region cleanup, equal-interval
   and quantile quantization modes, per-level preview. Pure, tested domain
   functions run in a Web Worker. Commit.
5. **Calibration system** — profile CRUD, default uncalibrated profile,
   height→setting mapping, calibration-strip generator, localStorage
   persistence, JSON import/export. Commit.
6. **Color system** — single/by-height/source-material modes, palette size
   control, deterministic k-means-style quantization in Lab space, swatch
   editing, C{n}-H{n} region IDs, symbol/pattern fallback for
   color-independent reading. Commit.
7. **Pattern composition & export** — legend, scale, registration marks, grid,
   labels/leader lines, punching-order suggestion, yarn-usage estimate,
   PNG/SVG/print-PDF (via browser print with physical page CSS, tiling,
   overlap, crop marks — see DECISIONS.md for why not a PDF library),
   project/calibration JSON persistence. Commit.
8. **Finished-piece simulation** — displaced subdivided plane, procedural
   fibre normal/roughness noise, loop/cut-pile presets, adjustable lighting,
   density, fabric color, comparison views. Commit.
9. **Tests & CI** — unit tests for every pure algorithm, component tests for
   the stage controls, Playwright E2E for the 10-step scenario + one
   file-import scenario. Commit.
10. **Docs & delivery** — remaining docs, screenshots (captured via a
    documented repeatable procedure since a live browser isn't available in
    this session — see TEST_REPORT), independent implementation review,
    final report.

## Risks

Biggest technical risk is Three.js depth-capture-to-canvas correctness
(render-to-texture from an orthographic camera, reading back a depth/linear-Z
buffer) — mitigated by keeping that logic in one small, well-commented,
unit-testable-at-the-math-level module (`depthCapture.ts`) separate from pure
math (`relief.ts`, `quantize.ts`) that *can* be fully unit tested without a
WebGL context. Second risk is claiming false verification — mitigated by the
policy above: nothing is marked passing without a captured run.

## Resolutions from independent plan review (see docs/PLAN_REVIEW.md)

1. **Scope discipline.** Milestones 3–8 remain as scoped (the product spec's
   requirements are explicit and detailed), but implementation priority
   within each milestone is: correct core behavior first, breadth of minor
   options second. Where a feature is simplified relative to the full spec,
   it is documented in `docs/DECISIONS.md` and `docs/LIMITATIONS.md` rather
   than silently included as if complete. Quantile quantization mode,
   source-material color mode, and punching-order suggestion are implemented
   but flagged as the first candidates to simplify if time runs out.
2. **Zero-compile risk.** The next networked session's mandatory first step
   is `npm install && npx tsc --noEmit` before running anything else, so
   type errors surface immediately. In this session, cross-module contracts
   (shared types in `src/domain/types.ts`) are centralized in one file and
   reused everywhere rather than re-declared, to minimize drift that a
   compiler would normally catch.
3. **Local-only asset resolution.** `objLoader.ts` builds a `Map<filename,
   blobURL>` from the user-supplied `FileList` and installs a Three.js
   `LoadingManager` with `setURLModifier` that resolves *only* against that
   map (case-insensitive basename match) and throws for anything else —
   absolute URLs, `http(s)://`, or unmatched filenames never reach `fetch`.
   Enforced by a unit test that asserts a manager constructed this way
   rejects a remote URL and an unmatched filename.
4. **Worker offload.** Color quantization (milestone 6) runs in the same Web
   Worker as the height pipeline (milestone 4), not on the main thread.
5. **Performance budget (documented, not yet measured in-browser).** Target:
   simulation mesh ≤ 200×200 displaced plane segments, ≤ 2K procedural noise
   texture, 60fps target / 30fps floor on a typical 2020+ desktop GPU;
   processing resolution default 256px longest edge, worker-based, adjustable
   down for slower machines. Real numbers to be measured and recorded in
   TEST_REPORT once a browser is available.
