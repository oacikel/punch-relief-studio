# Test Report

**Nothing in this document is claimed as "passing" unless a command was
actually run and its output captured below.** Where a command has not been
run, that is stated explicitly, along with the exact command to run it and
why it couldn't happen.

## Session 2: networked verification (this session)

Run from the repository root, Node 22.16.0 (via `nvm use 22`; the system
default Node was 18.20.0, so every command below was run with 22 explicitly
selected — see `.nvmrc` / `package.json` `engines`), npm 10.9.2.

### `npm install`

```
$ npm install
added 414 packages, and audited 415 packages in 17s
```

Exit code 0.

### `npm run typecheck` (`tsc -b --noEmit`)

First run surfaced exactly the class of issue predicted in
`docs/PLAN_REVIEW.md` item 2 (never-compiled code): **6 errors**, all fixed
in this session:

1. `src/domain/pattern/__tests__/yarnEstimate.test.ts` — spreading a
   `noUncheckedIndexedAccess`-typed possibly-`undefined` array element made
   `settingNumber`/`label` optional on the resulting object, which no longer
   satisfied `NeedleSetting`. Fixed with an explicit `undefined` check
   before the spread.
2. `src/domain/pattern/yarnEstimate.ts` — unused `Cm` type import. Removed.
3. `src/test/setup.ts` — an `@ts-expect-error` directive that no longer
   corresponded to a real error (unused-directive error). Removed.
4. `src/three/depthCapture.ts` — returning `color: Uint8ClampedArray |
undefined` into a field typed `color?: Uint8ClampedArray` violated
   `exactOptionalPropertyTypes`. Fixed by only assigning the key when
   `color !== undefined`.
5. `vitest.config.ts` — `defineConfig` was imported from `'vite'`, whose
   `UserConfigExport` has no `test` field; changed to import from
   `'vitest/config'`, which extends Vite's config type with `test`.

Second run: **0 errors**, exit code 0.

### `npm run format` (`prettier --check .`)

First run: 58 files never formatted (this codebase was written without a
formatter ever running against it) — `npm run format:write` applied
Prettier's formatting to all of them (pure formatting, no logic changes).
Second run: `All matched files use Prettier code style!`, exit code 0.

### `npm run lint` (`eslint . --max-warnings=0`)

First run: **4 errors, 2 warnings** (fails the `--max-warnings=0` gate, exit
code 1):

1. `src/components/Viewport3D.tsx` — unused `catch (err)` binding. Changed
   to `catch {}`.
2. `src/domain/__tests__/projectSchema.test.ts` — `_drop` destructured and
   never used. `@typescript-eslint/no-unused-vars` only had
   `argsIgnorePattern: '^_'`, not `varsIgnorePattern`; added the latter to
   `.eslintrc.cjs` since the codebase already uses `_`-prefix as its
   "intentionally unused" convention for function args.
3. `src/domain/filenameSanitize.ts` — `no-control-regex` on a regex that
   intentionally strips `\x00`-`\x1f` from filenames (the point of the
   function). Added a justified `eslint-disable-next-line`.
4. `src/domain/import/stlLoader.ts` — `THREE` was imported as a value but
   only used as a type (`THREE.BufferGeometry`); changed to `import type`.
   5–6. Two `react-refresh/only-export-components` warnings, from
   `CalibrationEditor.tsx` exporting a dead `downloadProfileJson` function
   (duplicate, unsanitized copy of `src/export/calibrationExport.ts`'s
   `exportCalibrationProfile`, and never called from anywhere) and
   `ExportStage.tsx` re-exporting `downloadJson` (also never imported by
   anything). Both were unused dead code; deleted rather than suppressed.

Second run: **0 errors, 0 warnings**, exit code 0.

### `npm run test` (`vitest run`)

First run: **9 of 129 tests failed** across 5 files. Root-caused each:

1. **Missing `afterEach(cleanup)`** (`src/components/__tests__/Legend.test.tsx`,
   `ImportStage.test.tsx`, 4 failures total) — this project's
   `vitest.config.ts` does not set `test.globals: true`, and
   `@testing-library/react`'s auto-cleanup only registers itself when it
   detects a _global_ `afterEach`. Without it, DOM trees from one test's
   `render()` leaked into the next test in the same file, producing
   "found multiple elements" and stale-DOM assertion failures. Fixed by
   explicitly importing `afterEach`/`cleanup` and calling
   `afterEach(cleanup)` in `src/test/setup.ts` — this was the root cause,
   not a bug in `Legend`/`ImportStage` themselves.
2. **jsdom has no `URL.createObjectURL`** (`objLoader.test.ts`, 3 failures)
   — jsdom 25.x doesn't implement Blob URLs at all. Added a minimal
   counter-based stub in `src/test/setup.ts` (same pattern already used
   there for the `HTMLCanvasElement.getContext` stub), since the import
   logic only needs distinct, revocable-looking URL strings, not real blob
   storage.
3. **Vacuous-truth test bug** (`regionCleanup.test.ts`, 1 failure) — the
   "never includes background pixels" test asserted
   `components.every(...) === false` on an input that correctly produces an
   _empty_ `components` array (all-background grid); `[].every(...)` is
   vacuously `true` in JS, so the assertion was wrong on its face, not the
   implementation. Fixed the test to assert `toHaveLength(0)` directly,
   which is what it actually meant to check. `findConnectedComponents`
   itself was not changed.
4. **Float32 precision in a `toEqual`** (`relief.test.ts`, 1 failure) — the
   "no-op when invert=false" test stored `Float32Array.from([0.2, 0.8])`
   then compared against float64 literals `[0.2, 0.8]` with `toEqual`;
   `0.2` isn't exactly representable in float32, so the round-tripped value
   differs from the literal in the last few bits. Fixed by comparing
   against `Array.from(Float32Array.from([0.2, 0.8]))` instead, matching
   the pattern the adjacent "flips" test already used
   (`toBeCloseTo`-style tolerance). `invertRelief` itself was not changed.

Second run: **20 test files, 120 tests, all passing.** Exit code 0.

```
Test Files  20 passed (20)
     Tests  120 passed (120)
  Duration  2.28s
```

Coverage (`vitest run --coverage`, `@vitest/coverage-v8` added as a
devDependency — it wasn't declared even though `vitest.config.ts` already
configured `coverage.provider: 'v8'`, so `npm run test -- --coverage` and
the CI "Unit tests" step would both have failed with `MISSING DEPENDENCY`
before this fix): domain/export/persistence/three modules are mostly at or
near 100% line coverage; `src/domain/samples/*` (deterministic sample
geometry generators) and `src/workers/processing.worker.ts` are low/zero
because they're exercised through Playwright E2E (real browser/worker
environment) rather than jsdom unit tests — see below.

### `npm run build` (`tsc -b && vite build`)

Exit code 0. `dist/index.html` (0.57 kB), one JS chunk (712.50 kB, gzip
194.11 kB) and the processing worker (7.43 kB). Two non-blocking Vite
warnings: `projectStore.ts` is both statically and dynamically imported
(so the dynamic import doesn't get its own chunk), and the main chunk is
over the 500 kB advisory size threshold. Neither breaks the build or the
app; both are code-splitting opportunities, not correctness issues, and are
left as-is (out of scope for this pass — flagged here for a future
perf-focused change, not fixed reactively).

**Build-tooling bug found and fixed independently of the above:**
`tsconfig.node.json` (covering `vite.config.ts`, `vitest.config.ts`,
`playwright.config.ts`) was missing `"noEmit": true`, unlike
`tsconfig.app.json` which has it. Since `npm run build` runs `tsc -b`
(not `tsc -b --noEmit`), this caused `tsc` to write `playwright.config.js`,
`playwright.config.d.ts`, `vite.config.js`, `vite.config.d.ts`,
`vitest.config.js`, `vitest.config.d.ts`, and `*.tsbuildinfo` files
directly into the repository root on every build. Fixed by adding
`"noEmit": true` to `tsconfig.node.json` (composite + noEmit together is
valid) and adding `*.tsbuildinfo` to `.gitignore`.

### `npx playwright install --with-deps chromium && npm run test:e2e`

First `test:e2e` run: chromium tests passed, but both `mobile-narrow`
project tests failed with `Executable doesn't exist at .../webkit-.../pw_run.sh`.
Cause: `playwright.config.ts`'s `mobile-narrow` project uses
`devices['iPhone 13']`, which is a **WebKit**-engine device descriptor in
Playwright, not Chromium — so `--install chromium` alone doesn't cover it.
Installed `webkit` as well (`npx playwright install --with-deps webkit`).
Also fixed `.github/workflows/ci.yml`, which had the same
chromium-only gap and would have failed identically in CI.

Second run, both spec files × both projects (chromium, mobile-narrow):

```
Running 4 tests using 4 workers
4 passed (16.1s)
```

Exit code 0. This covers: `e2e/main-workflow.spec.ts` (load ripple sample →
orient → generate relief with 5 height levels → color-by-height → preview
simulation → set width 30cm → export SVG download → save project JSON
download → reload returns to a consistent Import state) and
`e2e/import-fixture.spec.ts` (import a real local STL fixture,
`e2e/fixtures/cube.stl`, via the file input and confirm it advances to
Orient).

### `npm run build && npm run preview` + manual smoke test

Built and served via `vite preview --port 4173`. Loaded in a real browser
(Chromium, via the in-session Browser pane), console checked for errors
(none), then walked the full workflow manually: Import → clicked
"Concentric Ripple" sample → Orient (3D viewport renders and responds) →
Create relief (generated with 5 height levels) → Height levels table →
Yarn colors (color-by-height) → Preview (pattern view + finished-piece
simulation panel, explicitly labeled "SIMULATION -- NOT A PHOTO" per the
product constraint on not implying a real photo) → Export (width field).
No console errors at any stage. Screenshots captured with a short
Playwright script (not committed; used only to produce the PNGs below) into
`docs/screenshots/`:

- `01-import.png`, `02-orient.png`, `03-relief-before-generate.png`,
  `04-height-levels.png`, `05-yarn-colors.png`,
  `06-preview-simulation.png`, `07-export.png` — desktop viewport
  (1280×900), one per workflow stage.
- `08-narrow-viewport-import.png` — 390×844 (narrow/mobile-ish) viewport,
  Import stage, confirming the layout is usable at that width.

### `npm audit`

```
6 vulnerabilities (3 moderate, 1 high, 2 critical)
```

All 6 are in one dependency chain rooted in `esbuild`/`vite`, pulled in by
`vite` → `vitest` → `@vitest/mocker`/`vite-node` → `@vitest/coverage-v8` —
i.e. **the dev/test toolchain, not a runtime or production dependency**.
Specifically:

- `esbuild <=0.24.2` (moderate) — dev server request/response disclosure.
- `vite <=6.4.2` (high) — path traversal in optimized-deps `.map` handling
  and a `server.fs.deny` bypass on Windows; both dev-server-only.
- `vite-node <=2.2.0-beta.2`, `@vitest/mocker <=3.0.0-beta.4` (moderate) —
  depend on the vulnerable `vite`.
- `vitest <=3.2.5` (critical) — arbitrary file read/execute **only when the
  Vitest UI server is running**, which this project never starts (no `--ui`
  usage anywhere in scripts or CI).
- `@vitest/coverage-v8 <=3.2.5` (critical) — depends on the vulnerable
  `vitest`.

None of these packages, or any vulnerable code path, ship in
`dist/` (the production build depends only on `react`, `react-dom`, and
`three` at runtime — see `package.json` `dependencies`). `npm audit fix
--force` would resolve all of them but requires upgrading `vite` 5→8 and
`vitest` 2→4, both semver-major jumps across the whole build/test toolchain
(Vite plugin API changes, Vitest config/API changes) — a real migration
that needs its own dedicated verification pass, not something to force
through as a side effect of this session. Recorded here as a known,
low-risk (dev-tooling-only), open item rather than silently fixed or
silently ignored.

### Accessibility

Not run with an automated tool (axe-core) as of this section (Session 2) —
out of scope for what was asked in that pass. Manual review from the prior
session still holds (form inputs have labels, real button/input elements,
`role="alert"`/`role="status"` for messages, descriptive `aria-label`s,
`prefers-reduced-motion` respected) and was reinforced by the E2E specs,
which query the app by accessible role/label (`getByRole`, `getByLabel`)
throughout — those queries would fail if the relevant ARIA semantics were
missing, and they passed. **This gap was closed in Session 3 below** — see
that section for the real axe-core run and its result.

## Session 3: Iteration 03 Round 2 verification

Branch `feat/iteration-03-round-2`. Run from the repository root, Node
22.16.0 (`$HOME/.nvm/versions/node/v22.16.0/bin` prepended to `PATH`; the
worktree's shell wouldn't allow sourcing `nvm.sh` directly, so the already-
installed 22.16.0 binaries were used directly instead), npm 10.9.2.

### `npm install` / `npm install -D @axe-core/playwright`

Both exit code 0. `@axe-core/playwright` added as a devDependency (`^4.13.0`
resolved) for the new `e2e/accessibility.spec.ts` sweep (see below).

### `npm run verify` (`format` + `lint` + `typecheck` + `test` + `build`)

All green, exit code 0:

```
> prettier --check .
All matched files use Prettier code style!

> eslint . --max-warnings=0
(no output — 0 errors, 0 warnings)

> tsc -b --noEmit
(no output — 0 errors)

> vitest run
 Test Files  33 passed (33)
      Tests  235 passed (235)

> tsc -b && vite build
✓ built in 1.23s
```

(**Correction, caught by the second independent review pass below**: an
earlier draft of this exact block pasted a `232`-test count, from a
`verify` run captured before the `bounds` fix commit's own 3 new
`labelPlacement.test.ts` cases were added — a smaller recurrence of the
same "report a check without having actually run it last" mistake this
document exists to prevent. The number above is from a `verify` run
against the final commit on this branch, re-confirmed via a standalone
`npm run test` immediately before this correction was made.)

One `fitOrthographicCameraToExtent` unit test needed correcting during this
pass — the first draft compared frame height at aspect=1 (a square canvas)
against `contentHeight * paddingFactor`, which is mathematically wrong for
a canvas whose aspect doesn't match the content's aspect (the frame is
correctly forced to match canvas aspect exactly, which for an extremely
flat/wide box at a _square_ canvas necessarily wastes vertical space no
algorithm can avoid without cropping). Rewritten to compare the new
extent-based fit against the old isotropic-sphere fit at a realistic 4:3
canvas aspect for a modestly-flat relief-shaped box, asserting the new fit
wastes meaningfully less frame space — this is what the test now checks,
and it passes.

### `npx playwright install --with-deps chromium webkit` / `npm run test:e2e`

```
Running 60 tests using 6 workers
  1 skipped
  59 passed (22.4s)
```

Both `chromium` and `mobile-narrow` (WebKit) projects, exit code 0. The one
skip is the pre-existing, intentional `test.skip(browserName !==
'chromium', ...)` in `e2e/print-emulation.spec.ts` (PDF generation is
Chromium-only in Playwright) — unrelated to this round's changes. This run
includes:

- The new `e2e/preview-controls.spec.ts` mobile-overflow regression test
  (`document.documentElement.scrollWidth <= clientWidth` at 390px, plus a
  real click on the Export & print `<summary>` toggle) — passing on both
  projects.
- The new `e2e/accessibility.spec.ts` axe-core sweep — 6 tests × 2 projects
  = 12 total, all passing, **zero real violations found** against WCAG
  2.0/2.1 A/AA + best-practice rules across Import (before/after model
  load), Relief, Height levels, Yarn colors, and Preview (including the
  opened Export & print panel). This closes the accessibility gap noted at
  the end of Session 2 above.

### Independent review passes

Two independent, fresh-context `general-purpose` subagent reviews were run
against this branch per this project's established process (see
`docs/ITERATION_02_PLAN.md` §17/§18 for prior examples of the same
convention): one against the finished implementation before docs were
written, one against the final diff afterward. See the PR description for
this branch for both passes' findings and what was fixed in response.

## Session 4: Iteration 03 combined-workspace verification

Branch `feat/iteration-03-combined-workspace`. Run from the repository
root, Node 22.16.0 (`$HOME/.nvm/versions/node/v22.16.0/bin` prepended to
`PATH`), npm 10.9.2.

### `npm install`

Exit code 0. `@axe-core/playwright` (already a devDependency as of Round 2) needed a fresh `npm install` in this checkout since it hadn't
previously been installed here.

### `vitest.config.ts` fix, found during this session

`npm run test` from this checkout initially discovered and ran 202 test
files instead of this project's real ~33 -- the config's `exclude` list
(`['e2e/**', 'node_modules/**']`) doesn't match nested paths like
`.claude/worktrees/*/node_modules/**`, and providing a custom Vitest
`exclude` replaces (not extends) Vitest's own defaults. Fixed by adding
`.claude/worktrees/**` to the list; see `docs/DECISIONS.md`. All test
counts below are from the corrected config.

### `npm run verify` (`format` + `lint` + `typecheck` + `test` + `build`)

All green, exit code 0:

```
> prettier --check .
All matched files use Prettier code style!

> eslint . --max-warnings=0
(no output — 0 errors, 0 warnings)

> tsc -b --noEmit
(no output — 0 errors)

> vitest run
 Test Files  36 passed (36)
      Tests  255 passed (255)

> tsc -b && vite build
✓ built in ~1.3s
```

New test files: `src/hooks/__tests__/useLiveRelief.test.ts` (7 tests,
including a deferred-promise-based out-of-order-completion race test),
`src/components/__tests__/RotationControls.test.tsx` (4 tests),
`src/components/workspace/__tests__/{ReliefControls,YarnColorsGroup,
PatternPanel,Workspace}.test.tsx` (7/4/3/5 tests respectively).

### Real-browser verification before the e2e suite was updated

Before touching any e2e spec, the actual built app was driven through a
real headless-Chromium session (`npm run build && npm run preview`) to
confirm both architectural resolutions work end-to-end, not just pass
unit tests: live regeneration fired automatically on landing on Workspace
with no manual button; the rail's coverage chips and Pattern panel updated
without navigation; `document.querySelectorAll('[aria-label="Straighten
model"]')` returned exactly 1 element on both Import and Workspace (no
duplicate rotation controls); adjusting Pitch from Workspace's own
`SimulationPanel` rotation control changed the live chip values (proving
rotation from its new home genuinely affects the captured relief, not
just the on-screen simulation); rotation set from Import
(`document.getElementById('import-rotate-roll')`) was reflected in
Workspace's own control and vice versa (the lifted-`AppState` design
working as intended). No console errors observed.

Also used to find and fix, before the e2e suite even existed for it: the
`.screen-only` print-hiding gap and the `main.workspace-layout` grid
staying active during `@media print` (root-caused with a standalone
Playwright script emulating print media and inspecting `.print-pages`'s
actual computed style/bounding rect -- see `docs/DECISIONS.md` for the
fixes).

### `npx playwright test --project=chromium` / `--project=mobile-narrow`

```
chromium:       31 passed (17.7s)
mobile-narrow:  30 passed, 1 skipped (19.9s)
```

The one skip is the pre-existing, intentional
`test.skip(browserName !== 'chromium', ...)` in
`e2e/print-emulation.spec.ts` (PDF generation is Chromium-only in
Playwright), unrelated to this session's changes. Every spec that
navigated the old 5-stage wizard was updated for the new Import ->
Workspace flow (`e2e/main-workflow.spec.ts`, `e2e/orient-persistence.spec.ts`,
`e2e/preview-controls.spec.ts`, `e2e/print-emulation.spec.ts`,
`e2e/palette-picker.spec.ts`, `e2e/accessibility.spec.ts`); `e2e/
relief-workspace.spec.ts` was renamed to `e2e/workspace.spec.ts` (its
HeightStage-table assertions rewritten as chip-based) with two new tests
added (both preview panels visible at once; rotating from Workspace's own
controls changes the pattern). `e2e/orient-persistence.spec.ts` gained a
third test proving rotation from Workspace's own controls affects the
live-regenerated relief. `e2e/import-fixture.spec.ts` needed no change.

Two real bugs were found and fixed via this e2e run, not worked around in
the tests: an ambiguous `getByText('Export & print')` locator (the new
`StageNav` caption text contains the same substring) fixed by matching
exact text; and the print/`.screen-only` issues above, root-caused via a
standalone debug script before being fixed in `Workspace.tsx`/
`styles.css` and re-verified green.

### Independent review passes

Two independent, fresh-context `general-purpose` subagent reviews were run
against this branch per this project's established process: one against
the implementation plan before any code was written (found four concrete
gaps — `view`/`showGrid`/`mirrored` state needing to move up to
`Workspace.tsx`, `ExportPanel` needing the same not-ready-yet gate as the
preview panels, stale "Generate relief"-referencing copy, and a stale e2e
assertion plan — all fixed before implementation), one against the
finished diff afterward (found zero blocking issues). See the PR
description for this branch for both passes' full findings.

## Session 5: Workspace two-column redesign verification

Branch `feat/workspace-two-column-redesign`, based on commit `1172745`
(the merged "Workspace usability fixes" round). Run from the repository
root, Node 22.16.0 (`$HOME/.nvm/versions/node/v22.16.0/bin` prepended to
`PATH`), npm 10.9.2.

### `npm install`

Exit code 0, 461 packages, no fresh dependency additions this round.

### `npm run verify` (`format` + `lint` + `typecheck` + `test` + `build`)

All green, exit code 0:

```
> prettier --check .
All matched files use Prettier code style!

> eslint . --max-warnings=0
(no output — 0 errors, 0 warnings)

> tsc -b --noEmit
(no output — 0 errors)

> vitest run
 Test Files  35 passed (35)
      Tests  258 passed (258)

> tsc -b && vite build
✓ built in ~1.3s
```

`src/components/__tests__/Legend.test.tsx` was deleted (the `Legend`
component it tested is deleted -- see `docs/DECISIONS.md`).
`src/components/workspace/__tests__/Workspace.test.tsx` gained a new
"ready state, preview tab switch" describe block (3 new tests) exercising
the tab-switch default state and the removed jump-nav/Legend, deliberately
never clicking into the Simulation tab (would construct a real
`THREE.WebGLRenderer`, unavailable in jsdom -- see the file's own updated
doc comment). `src/components/workspace/__tests__/ReliefControls.test.tsx`
had its two coverage-chip tests replaced with one "no chip readout
anywhere" test, and dropped the now-nonexistent `levels` prop from every
render call.

### Real-browser verification before the e2e suite was updated

Per this task's own explicit requirement, the two-pane independent-scroll
mechanism, the tab switch, the model bar, and the mobile fallback were all
verified against a real running build (`npm run build`, served via a
dedicated `vite preview` instance and driven through the browser
automation tool) before any e2e spec was written or trusted, not inferred
from reading CSS. This caught two real bugs neither `npm run test` nor
casual CSS review would have surfaced:

1. **`document.documentElement.scrollHeight` reporting scrollable overflow
   beyond one viewport height** even though `.app-shell`, `#root`,
   `body`, and every individual descendant measured correctly bounded in
   isolation (`scrollHeight === clientHeight` on each). Bisected by
   selectively hiding rail children via `element.style.display = 'none'`
   in the live page until the contributing subtree was isolated. Fixed
   with an explicit `body.workspace-scroll-lock` class (see
   `docs/DECISIONS.md`) rather than continuing to chase the discrepancy
   through the CSS cascade.
2. **A leftover scroll position from Import carrying into Workspace**,
   reproduced first via this same manual verification (`window.scrollTo`
   moved the visible viewport even with the lock applied, because
   `overflow: hidden` stops _further_ scrolling but doesn't reset an
   existing position) and then again for real by the e2e suite itself
   (see below) before being fixed with an explicit `window.scrollTo(0, 0)`
   on entering the Workspace stage.

Both fixes were re-verified in the same real-browser session (independent
rail/preview `scrollTop` manipulation confirmed the other column never
moves; `window.scrollTo`/real wheel-scroll gestures confirmed the page
itself doesn't move at desktop width; a 390px-wide resize confirmed the
mobile fallback still scrolls normally) before the e2e suite was touched.

### `npx playwright test --project=chromium` / `--project=mobile-narrow`

```
chromium:       39 passed (14.6s)
mobile-narrow:  38 passed, 1 skipped (13.8s)
```

The one skip is the pre-existing, intentional
`test.skip(browserName !== 'chromium', ...)` in
`e2e/print-emulation.spec.ts` (PDF generation is Chromium-only in
Playwright), unrelated to this session's changes.

`e2e/workspace.spec.ts` was substantially rewritten: the jump-nav test
deleted (feature removed); the single-sided sticky-position tests replaced
with independent-scroll tests exercising both columns in light and heavy
states; a new true-50/50-width test; a new tab-switch test (only one of
Pattern/Finished-piece-simulation content in the DOM at a time); the
rail-section sticky-header test rewritten to scroll the rail's own
`scrollTop` instead of `window.scrollTo` (the rail is no longer part of
normal document flow at desktop width); and a new model-bar test (loaded
model name shown, "Change" navigates back to Import without clearing the
model). Every spec using `.level-chip` (a removed feature) as a readiness
signal was updated to wait on the Pattern view group instead; the two
spots using it as a genuine content-diff signal
(`e2e/main-workflow.spec.ts`, `e2e/orient-persistence.spec.ts`) were
replaced with the "Color by height" swatch-table row count (kept in exact
sync with the generated level count by `resizeSwatches`) or the Pattern
panel's `<img>` `src` attribute changing, not just a wait-swap -- see
`docs/DECISIONS.md` for why each is a genuine, not approximate,
replacement.

Two real, additional bugs were found and fixed via this e2e run, beyond
the two already found in manual verification above:

3. **`axe-core`'s `aria-valid-attr-value` rule (critical impact)** on the
   inactive tab button's `aria-controls`, which pointed at a tabpanel `id`
   that doesn't exist in the DOM while that tab is inactive (only one
   tabpanel is ever mounted). Fixed by removing `aria-controls` entirely
   -- the `role="group"` + `aria-pressed` pattern doesn't require it.
4. **`axe-core`'s `region` rule (moderate impact)** on `.model-bar__label`,
   page content not contained by any landmark. Fixed with
   `role="region" aria-label="Loaded model"` on `ModelBar`'s container.

A fifth issue -- `e2e/orient-persistence.spec.ts`'s "model rotation
carries over" test failing with "element not found" for `getByLabel(/^Roll/)`
-- was a real, expected consequence of the redesign rather than a bug:
Workspace's own rotation controls now live inside `SimulationPanel`,
which is only mounted while the Finished-piece simulation tab is active
(Pattern is the default tab). Fixed by adding the tab click before reading
the control, not by changing app behavior.

### Independent review passes

Two independent, fresh-context `general-purpose` subagent reviews were run
against this branch per this project's established process: one against
the implementation plan before any code was written (found one blocking
issue -- the plan's proposed symmetric reuse of the single-sided
`position: sticky` mechanism for both columns doesn't work once both
columns share a height cap, and the plan's own proposed regression test
would have passed vacuously; see `docs/DECISIONS.md` for the real
fixed-height layout built instead), one against the finished diff
afterward. The second pass ran the full local gate and full e2e suite
itself and confirmed the same results reported above, and found one real
issue: `e2e/orient-persistence.spec.ts`'s "rotating the model...changes
the live-regenerated pattern" test compared the Pattern `<img>`'s `src`
attribute before/after, which turned out to be a tautology -- switching
to the Finished-piece simulation tab (where the rotation control lives)
and back unmounts and remounts `PatternPanel`, and `usePatternSvgUrl.ts`
creates a fresh `blob:` object URL on every mount regardless of whether
`regionMap` actually changed, so the test could never fail (confirmed by
the reviewer reproducing the false-pass with the rotation step removed).
Fixed by comparing the actual fetched SVG text content instead of the URL
(`fetch(img.src).then(r => r.text())`, the same technique
`e2e/print-emulation.spec.ts` already uses) -- see `docs/DECISIONS.md`.
No other blocking issues found; everything else in the diff (the CSS
mechanism, the mobile fallback, the `LegendEntry`/`Legend` split, the
out-of-scope files staying untouched, the other e2e tests) was
independently re-verified as correct.

## Session 6: Iteration 04 needle-geometry verification (pre-rebase run)

**Note: this session's `npm run verify`/e2e run below was executed
_before_ discovering and rebasing onto the Workspace two-column redesign
(Session 5, `origin/main`'s `b87c370`) — this local `main` checkout was
stale and missing that push. The commands below and their green results
are preserved for the record of what was actually run, but they exercised
the pre-redesign UI; after the rebase, `npm run verify` was re-run once
more (see the note at the end of this section) to confirm the
needle-geometry feature still verifies clean against the current
`ReliefControls.tsx`/`App.tsx`/`useLiveRelief.ts`.**

Run from the repository root, Node 18.20.0, npm 10.5.0 (`node_modules`
already present in this environment — no `npm install` needed). Covers the
needle-geometry width-constraint feature (docs/ITERATION_04_PLAN.md): new
`src/domain/pattern/needleGeometry.ts`, `cleanupTinyRegionsByLevel` in
`src/domain/regionCleanup.ts`, `AppState.needleGeometry`, the worker/
`useLiveRelief`/`ProcessArgs` wiring, the two new "Needle & Pile" rail
fields, and the optional `ProjectFile.needleGeometry` persistence field.

### `npm run verify` (`format && lint && typecheck && test && build`)

First run: `prettier --check` flagged 4 files (my own new/edited files,
never run through `--write`) — fixed with `npx prettier --write` on exactly
those 4 files, no content change. Second run, clean:

```
Checking formatting...
All matched files use Prettier code style!

> lint
> eslint . --max-warnings=0
(no output -- zero warnings/errors)

> typecheck
> tsc -b --noEmit
(no output -- zero errors)

> test
> vitest run
 Test Files  37 passed (37)
      Tests  285 passed (285)
   Duration  3.23s

> build
> tsc -b && vite build
✓ 88 modules transformed.
✓ built in 1.48s
```

One real bug caught by this run, not a tooling false-positive: the first
`cleanupTinyRegionsByLevel` test (`src/domain/__tests__/regionCleanup.test.ts`)
had a wrong hand-computed expectation — `[5, 0, 0, 5]` assumed the two
single-pixel `5`-value components at each end would be left alone, but
they're each adjacent to a valid (non-background) neighbor and below the
threshold, so `cleanupTinyRegionsByLevel` correctly reassigns them (matching
`cleanupTinyRegions`'s own long-established behavior for the same shape).
Fixed by rewriting the test fixture (two components, both at or above
threshold) rather than changing the implementation — the implementation's
actual output was correct throughout; only my test's prediction was wrong.

The pre-existing "chunks larger than 500kB" build warning is unrelated to
this change (present before this session too, per the vite output shape)
and out of scope for this iteration.

### `npx playwright test --project=chromium` / `--project=mobile-narrow`

This environment's default Node (18.20.0) is below Playwright's minimum
(20+); re-ran with `nvm use 22` (same fix Session 2 used), no code changes
needed.

```
chromium:       38 passed (20.4s)
mobile-narrow:  37 passed, 1 skipped (15.3s)
```

The one skip is the same pre-existing, intentional Chromium-only PDF-
generation skip noted in Session 4. No spec needed updating for this
feature — the two new "Needle & Pile" fields default to blank/disabled, so
every existing spec's Workspace assertions (including the chip/coverage
checks in `e2e/workspace.spec.ts`) pass unchanged with the new fields
present but inert. No new e2e coverage was added specifically for the
needle-geometry constraint itself (its effect on generated region shape is
exercised at the unit level, per CLAUDE.md's domain-layer testability
requirement — `src/domain/pattern/needleGeometry.ts` and
`cleanupTinyRegionsByLevel` are pure and fully covered there); a future
session could add a dedicated e2e spec if the on-screen effect of setting
a needle diameter needs its own regression coverage.

### Post-rebase re-verification

The `main` checkout used above was, at the time, one commit **behind**
`origin/main` — missing the "Workspace two-column redesign" push (Session
5, `b87c370`), a large concurrent UI rework touching exactly the files
this feature also edits (`App.tsx`, `ReliefControls.tsx`, `Workspace.tsx`,
`useLiveRelief.ts`). Discovered when the product owner tried the running
preview and correctly flagged it as an old UI. Resolved by stashing the
uncommitted needle-geometry work, fast-forwarding `main` to the real
`origin/main` (safe -- local `main` had no unique commits), and
reapplying the stash: the domain/worker/hooks layer
(`needleGeometry.ts`, `regionCleanup.ts`, `appState.ts`,
`processing.worker.ts`, `useProcessingWorker.ts`, `projectSchema.ts`)
merged with zero conflicts (untouched by the redesign); `App.tsx`,
`useLiveRelief.ts`(+test), `ReliefControls.tsx`(+test), and three docs had
real conflicts, hand-resolved by re-integrating the needle-geometry
additions against the redesign's current structure (e.g. dropping the
now-removed per-level coverage-chip block `ReliefControls.tsx` no longer
has, combining `viewNonce` and `needleGeometry`/`patternDimensions` as
parallel `useLiveRelief` triggers rather than one replacing the other).

Full `npm run verify` (format/lint/typecheck/test/build): clean after one
Prettier auto-format pass. **286 tests** (up from 285 -- the redesign
added its own new `Workspace.test.tsx` cases), all green.

`npx playwright test --project=chromium` (post-rebase): **1 of 40 failed**
on the first full-suite run -- `e2e/accessibility.spec.ts`'s "Workspace
stage, immediately on arrival" -- but passed every time run in isolation
or at lower parallelism. Root-caused, not dismissed as flaky: axe-core's
`color-contrast` rule flagged `.live-status-pill--processing`'s text
(`#b5563c` on `#fbe9dd`, 4.08:1, below WCAG AA's 4.5:1 minimum) --
**a real, pre-existing bug from the Workspace two-column redesign**, not
anything introduced by this feature. It only surfaces when the axe sweep
happens to catch the page while `useLiveRelief`'s debounce+worker
round-trip is still showing "Processing…", which is timing/load-dependent
(reproducible under full 6-worker parallel load, not under a lighter
run) -- explaining why Session 5's own verification never caught it.
Fixed directly (`src/styles.css`): darkened the pill's processing-state
text color to `#954429` (same accent hue, 5.68:1 contrast, comfortable
margin above the 4.5:1 threshold), scoped to that one rule only --
`var(--color-accent)` itself is untouched since it's used elsewhere
against different backgrounds that already pass. Re-ran
`--project=chromium` **twice more** after the fix: **40/40 both times**.
`--project=mobile-narrow`: **39 passed, 1 skipped** (the same pre-existing
Chromium-only PDF skip). `npm run verify` re-run once more after the CSS
change: clean.

## Session 7: needle-width floor rewrite (area check -> local-thickness opening)

Same environment as Session 6 (Node 18.20.0, npm 10.5.0). Covers the
`applyNeedleWidthOpening`/`chebyshevDistanceTransform` rewrite
(`src/domain/regionCleanup.ts`) that replaced the earlier area-based
`cleanupTinyRegionsByLevel`/`minWidthAreaPxForLevel` (see
`docs/DECISIONS.md`'s "Needle-width floor: from area check to local-
thickness opening"), plus the new "Fine Ridges" built-in sample
(`src/domain/samples/fineRidges.ts`) and the Workspace regeneration
overlay (`.workspace-processing-overlay`, `src/styles.css`/`Workspace.tsx`).

### `npm run verify`

Clean after one Prettier auto-format pass (new test file wasn't run
through `--write` before the first check). **291 tests** (up from 286 --
5 net new: 4 in `regionCleanup.test.ts` replacing the 3 removed
`cleanupTinyRegionsByLevel` cases, 1 new `Workspace.test.tsx` overlay
test; `needleGeometry.test.ts` stayed at 15, its area-based tests renamed
in place to the linear-width equivalents), typecheck, lint, build all
clean.

The `applyNeedleWidthOpening` regression test (a solid 5x5 block with a
1px-wide, 3-long spike attached, flanked the spike's whole length by a
different level) was hand-derived by tracing exact Chebyshev distances
before running it, specifically to avoid an ambiguous (order-dependent)
assertion -- the spike's middle and tip cells were verified to have their
flanking-level neighbor strictly closer (BFS distance 1, both directly
adjacent) than any path back through the also-too-thin spike to the
block's real core, so the outcome is unambiguous regardless of BFS
traversal-order details. It passed first run, confirming the hand
derivation and the implementation agree.

### Live verification against the actual bug report

The product owner's original complaint ("even if the individual height
levels work, the combined area view would still need to obey our region
rules") was reproduced and confirmed fixed via the running app (see
below) using the new "Fine Ridges" sample and a real needle-diameter
value -- thin ridge tips that survived the old area-based check (their
component's _total_ area, including the wide base they're attached to,
cleared the threshold) are now correctly absorbed into neighboring
regions.

## Session 1 (prior, sandboxed): what was reviewed manually

This MVP was originally built in a sandboxed session with no outbound
network access, so nothing could be installed or run. See git history for
"docs: record independent implementation review outcome" for that session's
manual-review notes (20 test files / ~117 `it()` cases authored, an
independent fresh-context implementation review that found and fixed 3
blocking + 1 high + 3 medium + 2 low severity issues, and a manual
scripting-mistake scan). All of that is superseded by the actual compiler/
test-runner/browser results in this document, which is the first time any
of it has actually been executed.
