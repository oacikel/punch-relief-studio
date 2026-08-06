# Punch Relief Studio

*Turn 3D models into sculptural punch-needle patterns.*

Punch Relief Studio converts an OBJ or STL 3D model into a punch-needle
pattern with discrete yarn-color regions **and** discrete needle
pile-height regions, plus an interactive simulation of the finished
textile. It's a "slicer" for punch needle, the way a 3D-printing slicer
turns a mesh into printable layers -- here, the "slices" are a captured
relief, quantized into a small number of colors and heights.

## Status

This is an MVP (v0.1.0 in progress). It was built end-to-end -- domain
logic, UI, tests, and docs -- in a sandboxed environment with no network
access to npm or GitHub, so **dependency installation and all build/test/
lint commands have not yet been executed**. See docs/TEST_REPORT.md for
exactly what has and hasn't been verified, and docs/LIMITATIONS.md for
known gaps. This section will be updated once a networked environment runs
the full verification pass.

## Screenshots

Not yet captured in this session -- no browser was available (see
docs/TEST_REPORT.md for the repeatable screenshot procedure to run once a
browser is available). Once captured they'll live in `docs/screenshots/`.

## Features

- Built-in samples (concentric ripple, rounded relief, geometric steps) --
  try the full workflow with no upload.
- STL (binary/ASCII) and OBJ (+ MTL + local textures) import, entirely
  client-side, never fetching remote assets.
- Interactive 3D viewport: orbit/pan/zoom, standard views, reset.
- Orthographic depth capture -> foreground masking -> normalization ->
  inversion -> intensity -> edge-aware smoothing -> quantization (3-8
  levels, equal-interval or quantile) -> tiny-region cleanup.
- Needle/pile-height calibration profiles (explicitly labeled uncalibrated
  until measured), printable calibration strip, localStorage persistence,
  JSON import/export.
- Three color modes: single yarn, color-by-height, source-material
  (deterministic Lab-space palette extraction).
- Combined `C{n}-H{n}` region identity so the pattern never relies on color
  alone.
- Pattern views: combined / color-only / height-only / contour, with grid,
  legend, scale bar, and registration marks.
- Finished-piece simulation built from the same quantized data as the
  pattern (not the raw mesh), with loop/cut-pile presets and adjustable
  lighting.
- Export: SVG and PNG pattern, print via the browser's native PDF pipeline,
  project settings JSON, calibration profile JSON.

## Privacy

Everything runs client-side. Your model, textures, and pattern data never
leave your browser -- there's no account, no upload, and no analytics.

## Local setup

```bash
npm install
npm run dev       # start the dev server
npm run build     # production build
npm run test      # unit + component tests
npm run test:e2e  # Playwright end-to-end tests (needs `npx playwright install` first)
npm run verify     # format check + lint + typecheck + test + build
```

Requires Node 22 (see `.nvmrc`).

## Architecture

See `docs/ARCHITECTURE.md` for the full breakdown. Short version: pure,
framework-free domain logic in `src/domain`, Three.js code isolated in
`src/three`, expensive processing offloaded to a Web Worker
(`src/workers/processing.worker.ts`), React UI in `src/components`
(one component per workflow stage), plain reducers for state
(`src/state`), and export/persistence kept as their own layers.

## Export formats

SVG pattern, PNG pattern, print-to-PDF (via the browser's native print
pipeline against a print stylesheet), finished-simulation PNG (planned --
see docs/LIMITATIONS.md), project settings JSON, calibration profile JSON.

## Known limitations

See `docs/LIMITATIONS.md` for the full list. Headline items: single-
viewpoint bas-relief only (no undercuts), uncalibrated height levels are
relative order only, print-PDF multi-page tiling math is implemented and
tested but not yet fully wired into the print view, and no command in this
repository has been executed yet in this session due to a sandboxed
environment with no network access (see docs/DECISIONS.md).

## Browser requirements

A modern evergreen browser with WebGL2 support (recent Chrome, Firefox,
Safari, or Edge). No IE11 support.

## Testing

`npm run test` for unit/component tests, `npm run test:e2e` for Playwright.
See `docs/TEST_REPORT.md` for the current, honest state of what has and
hasn't been run.

## License

MIT, see `LICENSE`.
