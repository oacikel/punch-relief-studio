# Decisions

Format: decision, alternatives considered, why.

## No React Three Fiber

**Decision:** vanilla Three.js in `useEffect`-managed components.
**Alternative:** R3F for declarative scene graphs.
**Why:** the app has exactly two Three.js scenes (viewport, simulation),
each with a small, mostly-static set of objects. R3F's value is managing
*many* dynamic objects declaratively; here it would add a dependency
without simplifying anything (decision rule: prefer the simplest
architecture that satisfies the acceptance criteria).

## No bundled PDF library for print export

**Decision:** `window.print()` against a print stylesheet, with page-tiling
math (`printTiling.ts`) implemented and unit tested independently of the
browser print pipeline.
**Alternative:** jsPDF, pdf-lib, or similar.
**Why:** a PDF library is a meaningfully sized dependency for output the
browser can already produce natively, and native print respects the user's
own printer/page setup. **Trade-off accepted:** the automatic
multi-page-with-crop-marks tiling described in the product spec is only
partially wired into the UI in this MVP -- the math is correct and tested,
but the print view currently prints the current pattern view as one
continuous document rather than splitting it into per-tile pages with crop
marks baked in. Documented as a known gap in LIMITATIONS.md rather than
silently shipped as if complete (decision rule: prefer graceful limitations
over fake precision).

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
manager still *tries* to fetch, which is both a privacy leak (reveals the
user's IP/activity to a third party referenced in someone else's file) and
against the product's local-only privacy requirement. Raised as a blocking
issue in the plan review (docs/PLAN_REVIEW.md) and resolved this way before
implementation.

## Worker-based processing

**Decision:** the height pipeline *and* color quantization both run inside
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
