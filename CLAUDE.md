# CLAUDE.md — Punch Relief Studio

Working title/tagline live only in `src/config/branding.ts`; change naming
there, not by grepping strings across the app.

## What this is

A fully client-side (no backend) app that turns an OBJ/STL 3D model into a
punch-needle pattern (discrete yarn-color regions + discrete pile-height
regions) and an interactive simulation of the finished textile. See
`docs/PRODUCT_SPEC.md` for product truth, `docs/ARCHITECTURE.md` for module
boundaries, `docs/ALGORITHMS.md` for the processing pipeline,
`docs/DECISIONS.md` for why things are built the way they are, and
`docs/LIMITATIONS.md` for what's intentionally not solved.

## Architecture boundaries (do not violate)

- `src/domain/**` — pure TypeScript, zero React/Three.js imports, zero DOM
  APIs except where explicitly wrapped (e.g. `OffscreenCanvas` in a worker).
  Every function here must be unit-testable without a browser.
- `src/three/**` — Three.js scene/camera/renderer/depth-capture code. Talks
  to `src/domain` via plain data (typed arrays, `HeightRegionMap`, etc.),
  never the other way around.
- `src/workers/**` — Web Worker entry points that call into `src/domain`.
  Expensive image processing (relief pipeline, color quantization) runs here,
  not on the main thread.
- `src/components/**` — React UI. Components read/write app state and call
  `src/domain`/`src/three` functions; they must not contain quantization,
  scaling, or calibration math inline.
- `src/state/**` — app state (workflow stage, settings, project) as plain
  reducers/hooks, framework-light enough to unit test.
- `src/export/**` — PNG/SVG/PDF/JSON serialization, filename sanitization.
- `src/persistence/**` — localStorage + project-JSON schema/versioning.

## Units discipline

Never mix unit systems implicitly. Canonical types in
`src/domain/units.ts`: `Px` (raster pixels at a stated resolution),
`NormalizedDepth` (0–1), `ModelUnits` (raw mesh units, unknown real scale),
`Cm`, `Inch`. Conversions go through named functions
(`cmToPx`, `pxToCm`, …), never bare multiplication at call sites.

## Core commands

`npm install` (requires network) · `npm run dev` · `npm run build` ·
`npm run typecheck` · `npm run lint` · `npm run format` · `npm run test` ·
`npm run test:e2e` · `npm run verify` (runs the full local gate).

## Coding standards

TypeScript strict mode, no `any` outside tests, `noUncheckedIndexedAccess`
on. Prefer small pure functions with explicit input/output types over
classes. No default exports for domain functions (named exports only, so
`grep` finds call sites). No `dangerouslySetInnerHTML`. No network calls
anywhere in `src/` — this app must work offline after first load.

## Verification requirements

Before any commit that touches `src/`: `npm run typecheck && npm run lint &&
npm run test`. Before merging a milestone: `npm run verify` and, when a
browser is available, `npm run test:e2e`. Never report a check as passing
without having actually run it and captured the output — see
`docs/TEST_REPORT.md` for the running log of what has and hasn't been
executed and why.

## Git rules

Small atomic commits per milestone (see `docs/PLAN.md`). Conventional-ish
commit subjects (`feat:`, `fix:`, `test:`, `docs:`, `chore:`). Never
force-push `main`. Never commit secrets, tokens, or `.env*` files (already
gitignored).

## Important product constraints

- Output is a **single-viewpoint bas-relief interpretation**, not a full 3D
  reconstruction — communicated in-app, not just in docs.
- Never label an uncalibrated height level with a fake millimetre value.
  Calibration data is opt-in and its absence must be visibly flagged.
- Never rely on color alone to distinguish regions — always pair with a
  symbol/ID (`C{n}-H{n}`).
- No remote asset fetching for OBJ/MTL — see `docs/DECISIONS.md` for the
  `LoadingManager.setURLModifier` approach.
- Deterministic given the same input + settings — any pseudo-randomness uses
  a fixed seed (see `src/domain/random.ts`).

## Known environment limitation (as of this MVP's initial build)

This project was initially scaffolded in a sandboxed session with no
network access to npm or GitHub. If `node_modules` is missing or CI hasn't
run yet, that's why — see `docs/TEST_REPORT.md` for exactly what has and
hasn't been verified, and run `npm install && npm run verify` first in any
new environment.
