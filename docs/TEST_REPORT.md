# Test Report

**Nothing in this document is claimed as "passing" unless a command was
actually run and its output captured below.** Where a command has not been
run, that is stated explicitly, along with the exact command to run it and
why it couldn't happen in this session.

## Why no commands have been run yet

This MVP was built in a sandboxed session with no outbound network access:
direct requests to `registry.npmjs.org`, `github.com`, `raw.githubusercontent.com`,
and `pypi.org` all returned `HTTP 403` from the proxy, and no GitHub CLI or
GitHub MCP connector was available. `npm install` therefore cannot resolve
any dependency (confirmed: `npm install --offline lodash` fails with
`ENOTCACHED`, and no packages beyond bundled `npm`/`corepack` exist in this
environment). Every check below that needs a dependency has NOT been run.
See docs/PLAN.md and docs/DECISIONS.md for the full account.

## What has NOT been run, and the exact commands to run first

Run these in order in a normal, networked environment, from the repository
root:

```bash
node --version   # expect a 22.x LTS, per .nvmrc
npm install      # resolve all dependencies from package.json + generate package-lock.json
npm run format   # prettier --check .
npm run lint     # eslint . --max-warnings=0
npm run typecheck  # tsc -b --noEmit  <- run this FIRST after install, per docs/PLAN_REVIEW.md
npm run test     # vitest run (20 test files, ~117 test cases written -- see below)
npm run build    # tsc -b && vite build
npm run preview  # vite preview --port 4173, then smoke-test manually
npx playwright install --with-deps chromium
npm run test:e2e # 2 spec files: main-workflow.spec.ts, import-fixture.spec.ts
npm audit        # dependency/security audit
```

None of these have produced output in this session. Expect the first
`typecheck` run to surface real issues -- ~5,400 lines of TypeScript were
written without any compiler feedback (documented risk, see
docs/PLAN_REVIEW.md item 2); this report will be updated with the actual
error count and fixes once that command can run.

## What exists and was reviewed manually

- **20 unit/component test files**, approximately **117 `it()` cases**,
  covering: unit conversion, relief masking/normalization/inversion/
  intensity/smoothing, quantization (both modes, boundary behavior,
  determinism), region cleanup/connected components, region ID formatting,
  filename sanitization, calibration profile CRUD/validation/mapping,
  calibration strip generation, color quantization (Lab conversion,
  determinism, palette-size bounds, clustering behavior), yarn-usage
  estimate, punch-order suggestion, print-tiling math, project-schema
  validation and versioning, import validation and local-only asset
  resolution (security-relevant), workflow/app state reducers, and 3
  component tests (ImportStage, ErrorBoundary, Legend).
- **2 Playwright E2E spec files**: the 10-step main-workflow scenario from
  the product brief, and a local-STL-fixture import test using a
  hand-authored 12-triangle cube (`e2e/fixtures/cube.stl`).
- Every algorithmic module was manually traced against its test cases for
  logical consistency (e.g., boundary math in `quantize.ts`, connected-
  component correctness in `regionCleanup.ts`) since no compiler or test
  runner was available to verify automatically.
- A manual scan for common scripting mistakes (unescaped quotes inside
  string literals, mismatched template-literal delimiters) was run across
  all `src/**/*.ts(x)` files; one real bug found this way (an unescaped
  apostrophe breaking a string literal in `domain/import/validation.ts`)
  was fixed. This scan cannot substitute for an actual compiler run.

## Acceptance matrix reconciliation

See `docs/ACCEPTANCE_MATRIX.md` -- every row not marked "Verified" is
marked "Deferred-verify" with the exact command needed, consistent with
this report.

## Accessibility

No axe-core run has happened (needs a real browser). Manual review: form
inputs have associated `<label>`s (including visually-hidden labels for
table-embedded inputs), interactive elements are real `<button>`/`<input>`
elements (not clickable `<div>`s), status/error messages use
`role="alert"`/`role="status"`, the pattern/simulation views have
descriptive `aria-label`s, and `prefers-reduced-motion` is respected in
`src/styles.css`. Run once a browser is available:

```bash
npm run build && npm run preview
npx playwright test --grep @a11y   # if an axe-core Playwright test is added
# or manually: axe DevTools browser extension against localhost:4173
```

## Security audit

Not run (`npm audit` requires `npm install` first). No secrets exist in
this repository; `.gitignore` excludes `.env*` files.

## Screenshots

Not captured -- no real browser was available in this session. Repeatable
procedure once one is available:

```bash
npm run build && npm run preview
npx playwright test e2e/main-workflow.spec.ts --headed  # or add explicit page.screenshot() calls
```

Save representative screenshots (import, orient, relief, height, color,
preview, export, and a narrow-viewport view) to `docs/screenshots/`.
