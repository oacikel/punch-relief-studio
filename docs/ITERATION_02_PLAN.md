# Iteration 02 — Craft-Tool UX Pass

Status: **Stage A implemented and locally verified in Cowork Session 1**
(not yet pushed/merged/deployed — see `docs/COWORK_HANDOFF.md` for exactly
where delivery stands and why). See `docs/COWORK_HANDOFF.md` for the live
cross-session continuation state — if the two disagree, trust the handoff
and the repository, not this document's "Status" line, which is not kept in
perfect sync.

## 0. Why this iteration

Product owner's live-testing feedback on the deployed v0.1.0 MVP: the app
works, but it _feels_ like an engineering tool. A punch-needle crafter has to
understand mesh/raster/quantization vocabulary to use it. This iteration
reorganizes the workflow and re-labels controls around real punch-needle
concepts — `3D model → punch needle → yarn loops → pattern → physical printed
guide` — without removing any genuinely useful control and without rewriting
systems that already work. Full feedback source: the product owner's request
message for this session (not duplicated here in full; paraphrased per
section below with a pointer back to the numbered item).

Central product question for every decision in this document: **can a
punch-needle artist understand what to do, understand what each setting
changes physically, and trust that the printed pattern corresponds to the
project they are about to make?**

## 0.1 Independent review pass (before implementation)

A fresh-context reviewer (general-purpose agent, cold read — no visibility
into how this plan was authored) checked every claim in this document
against the actual code and found two real blocking issues, now resolved in
this plan before Stage A implementation started (both are also reflected in
the sections below, not just here):

1. **Print-output regression risk from the Preview/Export merge.**
   `@media print` in `src/styles.css` only ever had to hide
   `.app-header`/`.stage-nav`/`.export-controls`, because Export and Preview
   used to be mutually exclusive stages — Preview's own pattern/simulation/
   legend markup was never in the DOM at the same time as `.print-pages`.
   Once Export's panel is relocated onto Preview, Preview's own on-screen
   content would sit alongside `.print-pages` in the same stage panel and
   **leak into the print output** unless the print stylesheet also hides it.
   Resolution: Stage A wraps all of Preview's normal on-screen content (the
   pattern/simulation/legend section, not the relocated export panel's
   hidden `.print-pages` block) in a `.screen-only` wrapper, and the
   `@media print` rule hides `.screen-only` alongside the existing
   `.app-header`/`.stage-nav` selectors. Verified after implementation with
   the same print-media-emulation check described in §2.1.
2. **Undefined resolution of the `orient`-stage redirect after model load.**
   `App.tsx`'s `handleSelectSample`/`handleFilesSelected` both dispatch
   `GO_TO_STAGE stage: 'orient'` right after a model loads. The original
   draft of this plan proposed keeping `'orient'`/`'export'` as harmless
   redirect aliases in the workflow reducer "for safety" — the reviewer
   correctly pointed out this is unnecessary complexity (§2.2 already proves
   no real data path, persisted or not, can ever produce those values) _and_
   left the redirect target itself unspecified, which could silently send
   the user to `'relief'` instead of `'import'` and defeat the entire point
   of the merge. Resolution: **drop the alias/migration layer entirely**.
   `WORKFLOW_STAGES` simply becomes the 5-item list; the two call sites that
   used to dispatch `'orient'` are updated to not dispatch a stage change at
   all (the app is already showing Import, which now contains the post-load
   viewport) — removing dead complexity rather than adding defensive code
   for an input that provably cannot occur.

Two non-blocking corrections also folded in below: the Relief-control audit
table's "height levels ≈ needle settings" framing is qualified to note
`mapHeightLevelToSetting` can map several height levels onto one needle
setting when the profile has fewer settings than levels (the common case
today, with a 4-setting default profile and 3–8 levels); and §10's schema
precedent citation is corrected — `ExportSettings.view`/`showLabels` are
_not_ part of the persisted `ProjectFile` schema today, so they aren't
usable precedent for "additive field, no version bump."

## 1. Model-strategy note

The brief asks for Fable (a high-reasoning model) on UX/IA analysis, plan
authorship, and independent plan/implementation review, with Sonnet doing
implementation. **Fable returned "out of usage credits" when invoked in this
session** (one attempt, via the `Agent` tool with `model: "fable"`, task: UX
audit of the Relief-stage controls). Per the brief's own fallback rule, this
session performed the analysis/plan/review split itself instead:
analysis and first draft by the implementing session, then a second,
independent-context pass over the finished plan and again over the finished
Stage A implementation, checking specifically for the blind spots a second
pair of eyes would catch. No step in this document or in commit messages
claims Fable was used where it wasn't. Future sessions should retry Fable
first (it may be back), and should say plainly in their own
`COWORK_HANDOFF.md` update whether it was available.

## 2. Verified technical corrections to the product owner's feedback

The brief asks to verify assumptions before implementing. Three corrections
worth flagging up front, because they change scope:

1. **The print/PDF bug (feedback item 20) appears already fixed on `main`.**
   Commit `56e276e` ("First networked verification pass...") already replaced
   the naive `window.print()`-against-the-app-page behavior with a dedicated
   `.print-pages` block (hidden on screen, shown only via `@media print`,
   built from the same `RegionMap`/`legend` as the on-screen pattern) —
   see `src/components/stages/ExportStage.tsx` and the `@media print` rules
   in `src/styles.css`. This session verified it directly: built the app,
   drove it in a real (headless) Chromium instance to the Export stage,
   emulated print media, and separately rendered an actual PDF via
   Chromium's print-to-PDF path. The output shows the pattern, crop marks,
   page numbers, and the "5 cm scale check" square — not the application
   chrome. **Stage D is therefore "verify, hardened, and extend an existing
   working print pipeline," not "fix a broken one."** It may still have real
   gaps (dot-guide rendering doesn't exist yet, multi-page behavior needs
   fresh regression tests after the Stage A/C UI changes, and the product
   owner should confirm on their own printer per item 21's "always check
   with a ruler" guidance) — those are legitimate Stage D work, just not a
   from-scratch rewrite.
2. **Workflow stage is not persisted anywhere.** `WorkflowState.currentStage`
   is plain in-memory React reducer state (`src/state/workflow.ts`) — never
   written to `localStorage`, never part of `ProjectFile`
   (`src/domain/projectSchema.ts`, which has no stage field at all), never in
   a URL (no router in this app). It resets to `'import'` on every page load.
   So "old saved projects referring to an `orient`/`export` stage" (feedback
   item 1/19's migration ask) **cannot actually occur via project JSON**, and
   there is no localStorage key or URL to migrate either. Per the independent
   review in §0.1, Stage A therefore does **not** add alias/redirect logic
   for the old stage names — `WORKFLOW_STAGES` simply becomes the 5-item
   list, and the two call sites that used to send the user to `'orient'`
   after a model load are updated directly. No real migration path exists to
   defend against.
3. **Calibration currently lives inside the Export stage's UI, not a
   separate "Settings" page** (feedback item 13 assumes "Settings" already
   exists). `CalibrationEditor` is rendered directly inside
   `ExportStage.tsx`; there is no `/settings` route, settings modal, or
   settings nav item anywhere in the app. Stage A (this session) relocates
   the whole Export-stage content, calibration editor included, into a
   compact panel on Preview, since that's where Export's other actions are
   going anyway — this is a faithful move of existing UI, not a new
   information architecture. **Stage B must decide where calibration's
   permanent home is** (a real Settings surface reachable globally, versus
   staying inside the per-pattern Preview panel) before it can deliver
   feedback item 13's "contextual `Calibrate needle` action from the
   Heights/Needle stage, reusing the existing calibration system." This
   plan tracks it as an open decision below, not a foregone one.

## 3. Baseline verification (Session 1, before any change)

Run from a clean `npm install` on `main` @ `642294a`:

| Check                                 | Result                                                                                                                                                                                                                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run format`                      | pass                                                                                                                                                                                                                                                                                       |
| `npm run lint`                        | pass (0 warnings, `--max-warnings=0`)                                                                                                                                                                                                                                                      |
| `npm run typecheck`                   | pass                                                                                                                                                                                                                                                                                       |
| `npm run test`                        | 134/134 passing, 23 files                                                                                                                                                                                                                                                                  |
| `npm run build`                       | succeeds (one pre-existing chunk-size advisory, not an error)                                                                                                                                                                                                                              |
| `npm run test:e2e` (chromium project) | 3/3 passing, run against a locally pinned Chromium binary since this sandbox has no network path to Playwright's CDN — see `docs/COWORK_HANDOFF.md` for the one-line workaround; `mobile-narrow` (webkit) project untestable in this sandbox, no webkit binary available, not a code issue |

No pre-existing failures. Any regression found after Stage A changes is a
real regression, not sandbox noise.

## 4. Target workflow

```
Import  →  Create Relief  →  Height Levels (Needle & Pile)  →  Yarn Colors  →  Preview
```

Five visible stages, down from seven. Orient's content (3D viewport,
orientation controls, the single-viewpoint/no-undercuts honesty statement)
moves into Import, shown once a model is loaded, before "Create Relief."
Export's content (SVG/PNG/print/project-JSON/calibration) moves into a
compact panel on Preview. Internally, `orient` and `export` stop being
distinct `WorkflowStage` values; the underlying orientation state (camera
quaternion via the persistent `Viewport3D` instance) and all export/
calibration logic are unchanged — this is a navigation and layout change,
not a rewrite of either subsystem.

## 5. UX audit — Relief-stage controls (informs Stage B, not implemented yet)

Every control in `ReliefStage.tsx` today, verified against the actual domain
code (`src/domain/relief.ts`, `src/domain/quantize.ts`,
`src/domain/regionCleanup.ts`, `docs/ALGORITHMS.md`) rather than guessed:

| Control                                       | What it actually does                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Honest craft concept                                                                                                                                                      | Tier                                                                                                                                                                                                             | Plain-language direction                                                                                                                                                                                                  |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Height levels (3–8→2–12 per item 11)          | `quantize()` band count; directly the number of discrete pile-height bands the depth field is split into. **Qualification (independent review):** `mapHeightLevelToSetting` (`src/domain/calibration.ts`) distributes N height levels across M needle settings by index ratio when the counts differ — with today's 4-setting default profile and 3–8 levels, several height levels commonly share one needle setting. The plain-language copy must not claim a strict one-to-one mapping. | The number of distinct pile heights this pattern will produce, which may map several-to-one onto your needle's settings if you have fewer calibrated settings than levels | **Basic** — Needle & Pile                                                                                                                                                                                        | "Number of pile heights" — "How many distinct heights this pattern uses. If your needle has fewer settings than this, some heights will share a setting."                                                                 |
| Relief intensity                              | `applyIntensity`: scales deviation from the foreground mean; 0 flattens to a single average height, 1 keeps the full captured range                                                                                                                                                                                                                                                                                                                                                        | How pronounced the height differences are                                                                                                                                 | **Basic** — Shape Interpretation                                                                                                                                                                                 | "Relief depth" — "How dramatic the height differences are. Lower this to flatten subtle bumps toward one average height."                                                                                                 |
| Smoothing strength                            | `smoothRelief`: box blur blended with the source field, radius grows with strength                                                                                                                                                                                                                                                                                                                                                                                                         | Smooths tiny bumps so they don't become their own punch heights                                                                                                           | **Basic** — Shape Interpretation (the product owner's own item-8 example phrasing is this control's helper text almost verbatim — strong signal it belongs in Basic, not hidden)                                 | "Smoothing" — "Smooths tiny bumps so they don't turn into separate punch heights."                                                                                                                                        |
| Invert checkbox                               | `invertRelief`: flips which end of the normalized depth range is "1.0"                                                                                                                                                                                                                                                                                                                                                                                                                     | Whether the surface closest to your chosen view becomes the _tallest_ pile or the _shortest_                                                                              | **Basic** — Shape Interpretation                                                                                                                                                                                 | "Raise near surfaces" (checked = near→tall) — "Choose whether the part of the model closest to your view becomes the tallest loops or the shortest."                                                                      |
| Minimum region size (px)                      | `cleanupTinyRegions`/`findSmallRegions`: components smaller than this get merged into a neighbor or flagged                                                                                                                                                                                                                                                                                                                                                                                | The smallest region that's realistically punchable before it becomes fiddly                                                                                               | **Basic** — Punch Detail (already has a real punchability warning surfaced on the Heights stage — this is a load-bearing control, not decoration)                                                                | "Smallest punchable region" — "Removes tiny isolated areas that would be difficult to punch cleanly."                                                                                                                     |
| Output resolution (px, longest edge)          | Sets the captured depth raster's size — a computation/precision knob, **not** a physical measurement. It has no unit conversion to real loop spacing (that's a separate, not-yet-built physical parameter — see Stage C, item 16–18)                                                                                                                                                                                                                                                       | Roughly "how finely the shape is sampled before it's turned into regions" — higher can reveal more distinct spatial detail at a slower processing cost                    | **Advanced** — Punch Detail (sensible default of 256px covers most cases; conflating this with physical loop density would be dishonest, per CLAUDE.md's units discipline)                                       | "Detail resolution" — "How finely the shape is sampled. Higher settings can reveal more detail but take longer to process."                                                                                               |
| Quantization mode (equal-interval / quantile) | Chooses how band boundaries are placed: fixed-width slices of the depth range, vs. boundaries chosen so each band gets an equal _pixel_ count                                                                                                                                                                                                                                                                                                                                              | How the app decides where one pile height ends and the next begins                                                                                                        | **Advanced** — Shape Interpretation (genuinely useful for lumpy/uneven shapes, but the honest explanation is inherently more abstract than the others — hiding it behind disclosure is appropriate, not evasive) | "Height band spacing": "Even spacing" / "Balanced by shape" — "Even spacing splits the range into equal steps. Balanced spacing gives each pile height roughly the same share of the piece — useful for lopsided models." |
| Edge preservation                             | Only affects `smoothRelief`'s blend weight near strong local gradients; a secondary tuning knob on smoothing, not independently meaningful                                                                                                                                                                                                                                                                                                                                                 | How much smoothing backs off near a sharp edge                                                                                                                            | **Advanced** — Shape Interpretation                                                                                                                                                                              | "Keep edges crisp" — "Keeps sharp transitions (like the rim of a raised shape) less blurred while still smoothing flat areas."                                                                                            |

Recommended grouping (a refinement of the product owner's proposed
structure, not a departure from it):

- **Needle & Pile** (Basic): height-levels control, contextual calibration
  access, mapped pile-height read-out (the Heights stage already shows most
  of this).
- **Punch Detail**: minimum region size (Basic); output/detail resolution
  (Advanced).
- **Shape Interpretation**: relief intensity, smoothing, invert (Basic);
  quantization mode, edge preservation, behind an **"Advanced shape
  controls"** disclosure (matches the product owner's own suggested label
  in item 7).

This table and grouping is **input to Stage B**, not implemented this
session (Stage A does not touch `ReliefStage.tsx`'s controls or copy).

## 6. Orient → Import merge: safety check

`App.tsx` already renders exactly one `Viewport3D` instance, shared between
the `orient` and `relief` stages via a boolean OR on `workflow.currentStage`
— this is _why_ orientation currently survives navigating from Orient to
Relief (there's a regression test guarding exactly this,
`e2e/orient-persistence.spec.ts`). Folding Orient into Import is safe by
construction: add `'import'` to that same OR condition (post-model-load
only) instead of removing the shared-instance pattern. The
single-viewpoint/no-undercuts honesty copy currently owned by
`OrientStage.tsx` moves verbatim into the post-load section of
`ImportStage.tsx`. No change to `src/three/*` or `Viewport3D.tsx` internals
is needed.

## 7. Export → Preview merge: safety check

`ExportStage.tsx` owns: pattern dimensions, view selector, "print region
labels" checkbox, print page size, the four export/save/load buttons, the
calibration editor, **and** the hidden `.print-pages` markup that the
`@media print` stylesheet in `src/styles.css` depends on (it explicitly
hides everything _except_ `.print-pages` when printing, keyed partly on the
`.export-controls` class name). Moving this into a compact panel on Preview
is safe provided the `.print-pages` block moves with it as a unit (not left
orphaned) and the print stylesheet's selectors are updated to key off
whatever wraps the on-screen controls now, not the literal
`.export-controls` class if that class stops existing.

**Risk the first draft of this section understated (caught by the
independent review, §0.1):** Export and Preview used to be mutually
exclusive stages, so `.export-controls` was the _only_ other visible content
next to `.print-pages` during print. After the merge, Preview's own
pattern/simulation/legend markup shares the same DOM with the relocated
export panel — the existing `@media print` rule does not hide generic
`.stage-panel` children, so without a new rule, Preview's on-screen content
would print alongside (or instead of) the intended pattern. Fixed by
wrapping Preview's normal on-screen content in a `.screen-only` class that
`@media print` hides, same as `.app-header`/`.stage-nav` — see the Stage A
implementation checklist (§7.1) and the verification in §2.1.

### 7.1 Stage A implementation checklist (print-safety and navigation)

Concrete items the independent review found missing a home in this
document — tracked here so they're not lost between planning and
implementation:

- [ ] `@media print` in `src/styles.css` hides `.screen-only` (new wrapper
      around Preview's pattern/simulation/legend content) in addition to
      its existing `.app-header`/`.stage-nav` selectors, so only
      `.print-pages` is visible when printing from Preview.
- [ ] After Stage A, print-media-emulation verification (§2.1's method) is
      re-run against the new Preview-hosted export panel specifically, not
      just re-trusted from before the merge.
- [ ] `handleSelectSample`/`handleFilesSelected` in `App.tsx` no longer
      dispatch `GO_TO_STAGE stage: 'orient'` — the app is already showing
      Import when a model loads, which now contains the post-load viewport
      section directly.
- [ ] `StageNav.LABELS` (`src/components/StageNav.tsx`) — the actual
      accessible-name source for stage buttons — gets its embedded ordinals
      corrected to 1–5, not just the `WORKFLOW_STAGES` array (the review
      flagged this as easy to miss since it's a separate hardcoded map).
- [ ] `WORKFLOW_STAGES` becomes the 5-item list directly; no
      `'orient'`/`'export'` alias or redirect logic is added (§0.1) —
      confirmed unnecessary since no real data path can produce those
      values.

## 8. Milestone dependency graph

```
Stage A (workflow simplification: remove Orient/Export as visible stages)
   │
   ├── unblocks → Stage B (Relief workspace redesign: terminology, grouping,
   │              sticky preview, 12 levels, contextual calibration)
   │                  │
   │                  └── Stage B's "contextual calibration access" needs
   │                      Stage A's decision on where calibration now lives
   │                      (currently: Preview's compact panel) — Stage B may
   │                      relocate it again to a proper Settings surface.
   │
   ├── unblocks → Stage C (Preview controls: label toggle, punch-guide
   │              selector, physical dot spacing/density)
   │                  │
   │                  └── Stage C's physical punch-spacing parameter is new
   │                      state; needs a schema/persistence decision (below)
   │                      before Stage D can print it correctly.
   │
   └── Stage D (print/PDF reliability) depends on BOTH Stage A (export UI's
       new home) AND Stage C (dot guide + physical spacing must exist before
       print can render them) — Stage D cannot start before Stage C ships
       and is user-tested, per the one-milestone-per-session rule.

Stage E (polish) depends on A–D all having shipped and been user-tested;
explicitly not started until then.
```

Stage B and Stage C do **not** depend on each other and could in principle
swap order — kept in the product owner's requested A→B→C→D→E sequence
because that's also roughly increasing implementation risk, and because
Stage B's "contextual calibration access" question is cleaner to answer
once Stage A's relocation has been user-tested for a full session.

## 9. Affected modules per stage (architecture boundaries preserved throughout)

| Stage | `src/components/stages`                                                                                                                                                                                                                      | `src/state`                                                     | `src/domain`                                                                                          | `src/export`                                                                 | `src/persistence`                                                | New                                                                                   |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| A     | Import, Relief (viewport hookup), Preview (compact export panel), StageNav; delete Orient/Export as _stages_ (component code kept/relocated, not deleted, where it still does real work — e.g. `CalibrationEditor` is reused, not rewritten) | `workflow.ts` (stage list, migration aliases)                   | none                                                                                                  | none                                                                         | none                                                             | —                                                                                     |
| B     | Relief (full redesign), Heights (contextual calibration link)                                                                                                                                                                                | `appState.ts` (levels bound 3→2–12; may touch `ReliefSettings`) | `quantize.ts` (bound change), `calibration.ts` (needle-setting count flexibility)                     | none                                                                         | `calibrationStore.ts` (no schema change expected)                | possibly a `NeedleVisual` component (low priority, item 12)                           |
| C     | Preview (label toggle, punch-guide selector)                                                                                                                                                                                                 | `appState.ts` (new render/guide settings)                       | new: a small domain module for dot-guide geometry (pure, testable, lives under `src/domain/pattern/`) | `svgPattern.ts` (dot rendering path)                                         | `projectSchema.ts` (new fields — schema version bump, see below) | punch-guide domain module                                                             |
| D     | Preview (print trigger relocation only if needed)                                                                                                                                                                                            | none expected                                                   | none                                                                                                  | `printTiling.ts` (regression only, math is already correct), `svgPattern.ts` | none                                                             | possibly a dedicated print-composition helper if canvas-based dot rendering is chosen |
| E     | varies                                                                                                                                                                                                                                       | varies                                                          | varies                                                                                                | varies                                                                       | varies                                                           | `NeedleVisual` if not done in B                                                       |

## 10. Schema / migration risks

- **Workflow stage**: not persisted (§2.2) — no migration needed, only the
  defensive `GO_TO_STAGE` alias described above.
- **`ReliefSettings.levels` bound change (3–8 → 2–12, Stage B)**:
  `ProjectFile.reliefSettings` embeds this number directly
  (`src/domain/projectSchema.ts`). Old project JSONs with `levels` in 3–8
  remain valid under a widened range (no breaking change, purely additive).
  `quantize()`'s `RangeError` bound must move in lockstep with the UI slider
  and with `PROJECT_SCHEMA_VERSION` considerations — recommend a schema note
  (not necessarily a version bump, since old files stay parseable) rather
  than silent widening, so `docs/DECISIONS.md` records why 2–12 and not some
  other number.
- **New punch-guide / physical-spacing fields (Stage C)**: `ProjectFile` and
  `ExportSettings` gain new fields (guide mode, punch-spacing-mm, dot
  density divisor). `parseProjectFile`'s hand-written structural validation
  (`src/domain/projectSchema.ts`) requires every field in a fixed list to be
  present — **this means old project JSON files (schema v1, pre-Stage-C)
  will fail to load once new required fields are added**, unless Stage C
  either (a) makes the new fields optional with defaults applied on load, or
  (b) bumps `PROJECT_SCHEMA_VERSION` and writes a real v1→v2 migration
  function. **Correction (independent review, §0.1):** the first draft of
  this section cited `ExportSettings.view`/`showLabels`
  (`src/state/appState.ts`) as precedent for an "additive field, no version
  bump" pattern already in use — that citation was wrong. Those two fields
  live on the in-memory `AppState.exportSettings` only; `ProjectFile`'s
  persisted `exportSettings` (`src/domain/projectSchema.ts`) declares just
  `pageSize`/`overlapCm`/`orientation` and does not include `view` or
  `showLabels` at all, so there is no existing precedent in the actual
  persisted schema either way. Stage C planning should decide (a) vs. (b) on
  its own merits, not as a continuation of an established pattern.
- **Calibration profile schema**: item 11 (12 needle levels) may require
  `CalibrationProfile.settings` to support more than the current
  fixed-4-entries default and — critically — `CalibrationEditor.tsx`
  currently has **no add/remove-setting UI at all**, only edit-in-place for
  whatever `createDefaultProfile()` returns. Supporting up to 12 needle
  settings is a real UI + validation gap, not just a bound change; flagged
  for Stage B's implementation, not Stage A.

## 11. Testing requirements per stage

- **Unit/component**: every relocated component keeps its existing test
  file passing (`ImportStage.test.tsx`, `ExportStage.test.tsx`) or gets a
  rewritten test at its new location — never silently dropped coverage.
  `workflow.test.ts` gets new cases for the 5-stage list and the
  `orient`/`export` alias behavior.
- **E2E**: `e2e/orient-persistence.spec.ts`, `e2e/main-workflow.spec.ts`,
  `e2e/import-fixture.spec.ts` all reference stage labels/headings that
  Stage A changes (`"3. Create relief"`, `"Orient the model"` heading,
  `"7. Export"`, etc.) — all three need updates as part of Stage A, not as
  follow-up debt.
- **Visual**: screenshots at a normal desktop width and a narrow
  (~390–420px) viewport for every stage touched, captured against a local
  production build (`npm run build && npm run preview`) since this sandbox
  cannot reach the deployed GitHub Pages URL directly over the network (see
  `docs/COWORK_HANDOFF.md` for the exact limitation and workaround used).
- **Regression discipline**: per the top-level instructions, fix regressions
  before layering new work — any Stage A test failure blocks calling Stage A
  done, it does not roll forward into Stage B.

## 12. User acceptance criteria (Stage A)

A fresh user should perceive:

```
Import → Create Relief → Height Levels → Yarn Colors → Preview
```

with no separate Orient or Export stage in the primary nav. Specifically:

- Import shows the loaded model in an interactive 3D preview with
  orientation controls, states plainly that the chosen view determines the
  relief, and has an obvious next action into Create Relief.
- Preview retains every export action (SVG, PNG, print/PDF, save/load
  project JSON) and the calibration editor, reachable from a compact
  panel/menu rather than a wall of buttons.
- Reloading the browser, or reaching Preview via any path, never crashes or
  shows a broken/blank stage.
- Nothing that worked before (relief generation, height/color assignment,
  simulation, calibration CRUD, print output) regresses.

## 13. Deployment checkpoint per stage

Each stage ends with: branch pushed → CI green (or failures explained) → PR
opened → merged to `main` after verification → GitHub Pages deploy workflow
run confirmed → deployed URL spot-checked to contain the change → handoff
doc updated → **session stops**, no work begun on the next stage. See
`docs/COWORK_HANDOFF.md` for the live status of exactly where Stage A is
against this checklist right now, including any blocker (e.g. repository
push authorization) that paused it mid-stage.

## 14. Open decisions carried to Stage B

1. Where does calibration permanently live — a real Settings surface, or
   staying inside Preview's compact panel with a second contextual entry
   point from Heights? (§2.3)
2. Exact Basic/Advanced control split for Relief, per §5's table — this
   session's recommendation, not yet user-tested.
3. Whether `CalibrationProfile.settings` needs a real add/remove-setting UI
   before 12-level support is usable, or whether a fixed 12-slot profile
   (some unmeasured) is an acceptable interim (§10).
