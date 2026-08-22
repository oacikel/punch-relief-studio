# Iteration 02 — Craft-Tool UX Pass

Status: **Stage A merged and deployed to `main`** (commit `73f0868`).
**Stage B (Relief workspace redesign) merged and deployed to `main`**
(commit `7e550202c45dc2d16aa05930ed28f7f44af5d249`), confirmed live on
GitHub Pages. **Stage C (Preview controls: label toggle, punch-guide
selector, physical dot spacing/density) merged and deployed to `main`**
(commit `9e132cc191c0d97ae7476d984b2ea712cc0f0fcd`), confirmed live on
GitHub Pages. See §15 below for what was actually built for Stage B vs.
planned and how the §14 decisions were resolved; see §16 for Stage C's own
"what was actually built," including its schema and design decisions
(also recorded in full in `docs/DECISIONS.md`). **Stage D (print/PDF
reliability) implemented on branch `feat/ux-iteration-02-stage-d`**, off
`main` @ `9e132cc191c0d97ae7476d984b2ea712cc0f0fcd` (Stage A+B+C), locally
verified (full `npm run verify` plus `npm run test:e2e` on both the
`chromium` and `mobile-narrow`/webkit projects), PR opened against `main`,
not yet merged — per this iteration's deployment-checkpoint rule (§13), a
session implementing Stage D stops at "PR open, CI green" so a human can
review before it ships. See §17 for Stage D's own "what was actually
built," including the two real bugs it found and fixed. **Stage E's
open-ended polish audit findings were superseded by the product owner's
13-point Iteration 03 feedback** (see `docs/ITERATION_03_PLAN.md`) before
Stage E itself was ever formally scoped/implemented as its own stage; the
two Stage E findings that were _not_ covered by that feedback (the
camera-framing bug and Preview's mobile-narrow layout overflow) were
carried forward explicitly in `docs/ITERATION_03_PLAN.md`'s own
cross-reference section and finally resolved, along with three further
real bugs found on fresh re-verification, in **Iteration 03 Round 2** — see
§18 below. See `docs/COWORK_HANDOFF.md` for the Stage-A-era cross-session
continuation state — it predates Stage A's actual merge and Stage B/C/D's
implementation, so trust this document and the repository over it where
they disagree.

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

**Resolved in Stage B implementation** (full rationale in
`docs/DECISIONS.md`, flagged here so a reviewer can find the calls quickly
and agree/disagree before merge):

1. **Calibration stays inside Preview's compact panel.** A second,
   contextual "Calibrate needle settings" link was added on Height Levels
   instead of building a new global Settings surface — the app has no
   navigation concept outside the 5-item workflow stage list, and §9's own
   affected-modules table for Stage B only asked for "Heights (contextual
   calibration link)", not a new route/component. Left explicitly open for
   reconsideration if user testing shows people want to calibrate before a
   model is loaded (Preview is `hasModel`-gated).
2. **Implemented as designed, no deviation from §5's table**, with one
   small gap filled in: the table only names one disclosure label
   ("Advanced shape controls", the product owner's own item-7 phrasing);
   Punch Detail's lone Advanced field (output resolution) needed its own
   disclosure too, named "Advanced punch detail controls" for consistency
   rather than left unlabeled.
3. **Real add/remove UI was built**, not a fixed 12-slot stub — leaning on
   §10's own diagnosis that this was "a real UI + validation gap, not just
   a bound change." Turned out to be low-risk: the domain layer
   (`mapHeightLevelToSetting`, `generateCalibrationStrip`) already handled
   an arbitrary setting count with no changes needed; the actual gap was
   UI-only, exactly as §10 predicted. New pure `addNeedleSetting`/
   `removeNeedleSetting` functions live in `src/domain/calibration.ts`
   (moved there from the editor component after independent review flagged
   the first draft as calibration-mutation logic sitting in
   `src/components/**`, against CLAUDE.md's architecture boundary).

## 15. Stage B — what was actually built

Implemented on branch `feat/ux-iteration-02-stage-b` (off `main` @
`73f0868`, Stage A). Scope was Relief-stage terminology/grouping, the 2-12
height-level widening, sticky preview, contextual calibration access, and
calibration add/remove UI — Stage C/D/E untouched.

- **Relief-stage terminology, copy, and Basic/Advanced grouping**
  (`src/components/stages/ReliefStage.tsx`): every control renamed and
  regrouped per §5's table verbatim (label text, helper text, and tier).
  Three groups — **Needle & pile** (height levels only), **Punch detail**
  (minimum region size Basic, output resolution behind "Advanced punch
  detail controls"), **Shape interpretation** (relief depth/smoothing/
  invert Basic, quantization mode/edge preservation behind "Advanced shape
  controls"). No changes to the underlying `onChange`/`ReliefSettings`
  wiring — purely presentation.
- **2-12 height levels**: `computeLevelBounds`'s `RangeError` bound
  (`src/domain/quantize.ts`), the Relief-stage slider `min`/`max`, and the
  `ReliefSettings.levels` comment (`src/domain/types.ts`) all widened
  together. Two fixed-size arrays sized for the old 8-level ceiling were
  found (via independent plan review) and widened to 12 in lockstep:
  `HEIGHT_SYMBOLS` (`src/domain/regionId.ts`) and `DEFAULT_PALETTE`
  (`src/state/appState.ts`) — see `docs/DECISIONS.md` for why these were
  in scope even though the original plan didn't name them.
- **Sticky preview** (`src/App.tsx`, `src/styles.css`): a `className`
  toggle on `<main>` (`relief-layout`) and on the shared `Viewport3D`
  wrapper (`relief-preview-col`) — deliberately not a new conditional
  wrapper element, to protect the existing "Viewport3D never remounts
  between Import and Relief" invariant. CSS grid two-column layout with
  `position: sticky` on the preview column, falling back to normal
  stacking at the same 720px breakpoint `.app-shell` already uses. See
  `docs/DECISIONS.md` for the interpretation of the one-line "sticky
  preview" spec.
- **Contextual calibration access** (`src/components/stages/
HeightStage.tsx`, `src/components/stages/PreviewStage.tsx`,
  `src/components/ExportPanel.tsx`, `src/App.tsx`): a "Calibrate needle
  settings" link/button on Height Levels dispatches to the Preview stage
  and sets a `focusCalibration` flag (local `useState` in `App.tsx`, kept
  out of `appReducer` since it's ephemeral navigation state, not app
  data), which `ExportPanel` uses to force its `<details>` open and
  scroll/focus the calibration section, then reports back via
  `onCalibrationFocused` so the flag doesn't keep re-forcing the panel
  open on later, ordinary visits to Preview.
- **`CalibrationEditor` add/remove UI** (`src/components/
CalibrationEditor.tsx`, `src/domain/calibration.ts`): "Add needle
  setting"/"Remove" controls, 1-12 settings per profile
  (`MIN_NEEDLE_SETTINGS`/`MAX_NEEDLE_SETTINGS`), backed by pure
  `addNeedleSetting`/`removeNeedleSetting` domain functions.
  `validateProfile` also gained an explicit >12 check, so a profile
  imported directly as JSON can't silently exceed the cap either.
- **Process followed per this iteration's own convention**: a draft
  implementation plan was reviewed by an independent, fresh-context
  `general-purpose` subagent before implementation began (found no
  blocking issues, several real completeness gaps — the fixed-size
  `HEIGHT_SYMBOLS`/`DEFAULT_PALETTE` arrays, incomplete prop-threading
  itemization for the calibration-focus flow — all addressed before
  coding); a second independent, fresh-context review ran against the
  finished implementation (found one real architecture-boundary issue —
  calibration add/remove logic living in the component instead of
  `src/domain/calibration.ts` — fixed by extracting
  `addNeedleSetting`/`removeNeedleSetting`; everything else came back
  clean on a skeptical, traced-not-trusted read).
- **Verification**: `npm run verify` (format + lint + typecheck + test +
  build) green, 157/157 unit/component tests passing (26 files, up from
  137/23 at the Stage A baseline on `main` @ `73f0868` — 3 new test files
  for `ReliefStage`, `HeightStage`, and `CalibrationEditor`, none of which
  had coverage before Stage B, plus additions to `ExportPanel.test.tsx`
  and `calibration.test.ts` — the growth is genuinely new Stage B
  coverage, not renamed existing tests). `npm run test:e2e` green on both
  the `chromium` and
  `mobile-narrow` (WebKit) projects, 12/12 tests, including a new
  `e2e/relief-workspace.spec.ts` covering the Advanced-controls
  disclosures, the sticky/static CSS position at desktop vs. narrow
  viewports, and the Height Levels → Preview calibration-focus flow
  end-to-end.

## 16. Stage C — what was actually built

Implemented on branch `feat/ux-iteration-02-stage-c` (off `main` @
`7e550202c45dc2d16aa05930ed28f7f44af5d249`, Stage A+B). Scope was the
on-screen label toggle, the punch-guide selector/spacing overlay (screen
and export/print), and the schema decision for persisting it — Stage D/E
untouched.

- **Investigation before implementation** confirmed (not assumed) the two
  facts the plan flagged as open: (1) `PreviewStage.tsx`'s on-screen
  pattern hardcoded `showLabels` to `true` with no toggle at all,
  completely independent of the pre-existing "Print region labels"
  export checkbox (`ExportSettings.showLabels`, `src/state/appState.ts`),
  which only ever affected SVG/PNG/print output; (2)
  `parseProjectFile` (`src/domain/projectSchema.ts`) only checks
  top-level key presence, never nested shape, so a new optional field on
  `ProjectFile.exportSettings` is safe to add without a version bump.
- **On-screen label toggle** (`src/components/stages/PreviewStage.tsx`):
  a "Region labels (C1-H1 etc.)" checkbox, independent of the export
  panel's own toggle, wired to a new `AppState.patternViewSettings.
showOnScreenLabels` field (`src/state/appState.ts`), defaulting `true`
  to preserve the pre-Stage-C always-on behavior exactly.
- **Punch-guide overlay** (`src/domain/pattern/punchGuide.ts` — new pure
  domain module; `src/export/svgPattern.ts`; `src/hooks/
usePatternSvgUrl.ts`; `src/components/PatternCanvas.tsx`;
  `src/components/ExportPanel.tsx`; `src/components/stages/
PreviewStage.tsx`): a "Punch guide" selector (None/Dots) plus a "Dot
  spacing (cm)" input (0.2–5cm, default 1cm), producing an evenly-spaced
  square dot grid across the full pattern canvas. Geometry lives entirely
  in the new pure domain module, using the named `cm`/`cmToPx` functions
  from `src/domain/units.ts` for every physical-to-pixel conversion — the
  first place in the app a genuinely user-set physical measurement
  (as opposed to a computation knob like output resolution) crosses that
  boundary. One shared `punchGuide` setting drives both the on-screen
  pattern and every SVG/PNG/print export, rather than a duplicated
  per-surface control. `usePatternSvgUrl` was refactored from six
  positional primitive arguments to a single `SvgPatternOptions` object
  as part of this change, to avoid making an already-long positional call
  signature worse.
- **Schema decision (a): optional field, no version bump.**
  `ProjectFile.exportSettings` gained an optional `punchGuide` field;
  `PROJECT_SCHEMA_VERSION` stayed `1`; old (pre-Stage-C) project files
  load unmodified, with `App.tsx`'s `handleLoadProjectJson` supplying an
  explicit `{ mode: 'none', spacingCm: 1 }` default when the field is
  absent. Full rationale in `docs/DECISIONS.md`
  ("Punch-guide/physical-spacing schema fields: optional field, no
  version bump"), including why this was decided on the field's own
  merits rather than by analogy to Stage B's schema note or the
  (corrected) `view`/`showLabels` non-precedent, per the plan's own §10
  instruction not to treat it as a continuation of an established
  pattern.
- **Design decision: a minimal, honestly-labeled dot-grid overlay.** No
  region-silhouette clipping, no hex packing, no separate "density"
  control distinct from spacing — full rationale, including why each was
  rejected as unrequested scope, in `docs/DECISIONS.md` ("Punch-guide
  design: a minimal, honestly-labeled dot-grid overlay").
- **Safety cap added during implementation review** (not in the original
  plan): `computePunchGuideDots` caps total dot count at 20,000,
  widening the effective spacing (never narrowing it) when a large
  pattern at minimum spacing would otherwise generate hundreds of
  thousands of `<circle>` elements synchronously in the on-screen
  Preview's render path. Covered by dedicated unit tests. See
  `docs/DECISIONS.md` for the full writeup.
- **Process followed per this iteration's own convention**: a draft
  implementation plan (including the investigation findings above and
  both design/schema decisions) was reviewed by an independent,
  fresh-context `general-purpose` subagent before implementation began —
  found no blocking issues, and several non-blocking refinements (dot
  rounding-drift avoidance, explicit paint-order callout, noting
  `showOnScreenLabels`'s non-persistence as a deliberate choice) all
  folded into the plan before coding started. A second independent,
  fresh-context review ran against the finished diff — found no blocking
  issues, and two real non-blocking gaps: a stray, unused `punchGuide`
  key that would have leaked into `AppState.exportSettings` on project
  load (two sources of truth for the same setting), and the missing dot-
  count safety cap described above. Both fixed before opening the PR.
- **Verification**: `npm run verify` (format + lint + typecheck + test +
  build) green, 187/187 unit/component tests passing (28 files, up from
  157/26 at the Stage B baseline — a new `punchGuide.test.ts` with 13
  cases for the domain module, plus additions to `svgPattern.test.ts`,
  `appState.test.ts`, `projectSchema.test.ts`, and `ExportPanel.test.tsx`,
  none of which existed for this feature before Stage C). `npm run
test:e2e` green on both the `chromium` and `mobile-narrow` (WebKit)
  projects, covering a new `e2e/preview-controls.spec.ts`: the on-screen
  label toggle's independence from the export label checkbox, the
  punch-guide selector revealing/hiding the spacing input, the spacing
  input holding a user-entered value, and the export panel having no
  duplicate punch-guide control of its own.

## 17. Stage D — what was actually built

Implemented on branch `feat/ux-iteration-02-stage-d` (off `main` @
`9e132cc191c0d97ae7476d984b2ea712cc0f0fcd`, Stage A+B+C). Scope was
verifying and hardening the print/PDF pipeline's handling of Stage C's
punch-guide overlay and refreshing multi-page tiling regression coverage
— Stage E untouched.

- **Investigation before implementation** reproduced the print pipeline
  directly: built the app, drove a real headless Chromium instance
  (Playwright) to Preview with the punch guide set to "Dots" at 0.5cm
  spacing and pattern dimensions (60cm x 40cm on A4, 1cm overlap) chosen
  to force multi-page tiling, called `page.emulateMedia({ media: 'print'
})`, fetched the actual blob-URL SVG behind the print `<img>`, and
  rendered a real PDF via `page.pdf({ format: 'A4', printBackground: true
})` — rasterized with `pdftoppm` at 100dpi for pixel measurement (not
  committed to the repo; a throwaway script, per this iteration's own
  established verification method from §2 item 1). Confirmed: the
  punch-guide dot grid appears in the printed SVG (9600 circles at the
  configured density, matching a 120x80 grid — the `MAX_PUNCH_GUIDE_DOTS`
  safety cap correctly did not trigger); the pattern tiles across exactly
  8 pages (4 cols x 2 rows), each page edge-to-edge with correct crop
  marks/page numbers and no gaps; the physical page size, tile width, and
  the "5cm scale check" square all measured within antialiasing tolerance
  of their true physical dimensions (the scale bar's contiguous black run
  measured 196px at 100dpi = 4.98cm against an expected 5cm); the scale
  bar and registration marks are never obscured by the dot grid, because
  `buildSvgPattern`'s existing paint order (regions -> contour -> labels
  -> grid -> punch guide -> registration -> scale bar) already paints them
  on top; and region labels stay legible over the dots via their existing
  white stroke halo.
- **Two real bugs found and fixed, outside the punch-guide question this
  stage was primarily scoped to investigate** — both in "Actual project
  size" printing, both crashing the entire app past the top-level
  `ErrorBoundary`, both found by independent review rather than this
  session's own initial manual repro (which only ever exercised
  `pageSize: 'a4'` at typical dimensions):
  1. `ExportPanel.tsx`'s `computeTiling(...)` call never passed the 6th
     `actualSizeCm` parameter; `computeTiling` called
     `getPageDimensionsCm(pageSize, actualSizeCm)` unconditionally before
     its own single-page fast path, throwing
     `actualSizeCm is required when pageSize is "actual-size"` whenever
     `pageSize` was `'actual-size'` (always true at this call site).
     Reproduced live in headless Chromium (the app rendered "Something
     went wrong... actualSizeCm is required when pageSize is
     'actual-size'"). Found by the first independent, fresh-context
     `general-purpose` plan-review subagent (see below). Fixed by always
     passing the pattern's own current dimensions as `actualSizeCm` (a
     no-op for the `'a4'`/`'letter'` branches, which never read it).
  2. A second, deeper bug the same page-size option masked from the first
     fix: `computeTiling` computed `printableWidthCm`/`printableHeightCm`
     from `marginCm` and validated them against `overlapCm`
     unconditionally, even for `pageSize === 'actual-size'`, where margin
     and overlap are print-page concepts that don't apply at all (there is
     no physical page smaller than the pattern to tile across — the
     function's own single-page fast path already special-cased
     `'actual-size'`, but only _after_ this validation had already run). A
     small actual-size pattern (e.g. 1cm x 1cm, below the default 1cm
     margin x2 + 1cm overlap) still crashed the app with "overlap is too
     large for the printable page area." Found by the second independent,
     fresh-context review of the finished diff (see below), which
     reproduced it live with a tiny pattern rather than the typical-size
     patterns every other test in this stage used. Fixed by
     short-circuiting on `pageSize === 'actual-size'` before the
     margin/overlap validation runs, returning a single page sized to the
     pattern's own dimensions directly.
- **No dot-guide-in-print bug was found.** `ExportPanel.tsx`'s print path
  (`usePatternSvgUrl`, feeding the hidden `.print-pages` block) already
  received the same `punchGuide` prop as the on-screen `PatternCanvas` —
  both call the same `buildSvgPattern` function, so "what you preview is
  what prints" is structurally guaranteed by shared code, not duplicated
  logic that could drift out of sync. Multi-page tiling clips one
  full-canvas SVG per tile via a CSS negative margin
  (`.print-page-crop`), so the punch-guide dot grid — computed once
  against the whole pattern, never per-tile — tiles automatically and
  correctly with no separate per-tile geometry recomputation. There was
  no dot-on-tile-boundary design decision to make: a dot that falls in a
  tile's overlap zone appears on both tiles' printed image, the same as
  the pattern content itself already does — established, intentional
  overlap behavior, not a new question the punch guide introduced.
- **Regression tests added** (no other production code changes):
  - `src/export/__tests__/svgPattern.test.ts` — pins the SVG paint-order
    invariant (punch-guide layer painted before the registration marks
    and the scale bar) that is the actual reason the scale-check square
    stays legible.
  - `src/export/__tests__/printTiling.test.ts` — anchors the exact
    60x40cm/A4/1cm-overlap case this session verified manually (4 cols x
    2 rows = 8 pages), a row-major page-numbering ordering test, a
    zero-overlap abutting-tiles test, and (added after the second bug
    above was found) a tiny-actual-size-pattern test plus a test asserting
    `actualSizeCm`/margin are ignored entirely for the returned page
    geometry in the `'actual-size'` case.
  - `src/components/__tests__/ExportPanel.test.tsx` — a test spying on
    the real `usePatternSvgUrl` implementation to prove the _print_ image
    path (not just the on-click SVG/PNG export button handlers) actually
    receives the `punchGuide` prop, plus regression tests for both
    "Actual project size" crashes above (typical-size and tiny pattern).
  - New `e2e/print-emulation.spec.ts` — the first e2e spec in this repo to
    actually emulate print media. Covers: multi-page tile count matching
    the panel's own helper text; the print stylesheet still hiding app
    chrome and showing only `.print-pages` after Stage A/B/C's layout
    changes; the printed SVG containing both the punch-guide dot grid and
    the scale-check square together (with the paint-order assertion
    mirrored from the unit test); a punch-guide-"None" regression; both
    "Actual project size" fixes confirmed end-to-end in a real browser
    session (typical-size and tiny pattern); and a Chromium-only real PDF
    render checked for the expected page count via the PDF's own
    `/Type /Page` object count (a coarse, dependency-free heuristic —
    verified against the known-8-page case from this session's manual
    investigation). Playwright only supports `page.pdf()` on headless
    Chromium, so that one block is skipped (`test.skip`) on the
    `mobile-narrow`/WebKit project; every other assertion in the file runs
    on both projects.
  - Every new/changed test was confirmed to actually fail against a
    deliberately-reverted version of the corresponding production code
    before being left in its passing state, per this project's
    verification discipline (CLAUDE.md).
- **Process followed per this iteration's own convention, and it caught
  real bugs both times**: a draft plan (including the investigation
  findings above, before either bug was found) was reviewed by an
  independent, fresh-context `general-purpose` subagent, which read the
  actual source itself rather than trusting the draft's summary and found
  the first "Actual project size" crash — a real, currently-reachable bug
  squarely in Stage D's own stated scope, missed because the manual repro
  only ever tested `pageSize: 'a4'`. The plan was revised to fix it (as
  its own small, atomic commit, separate from the test-only commits)
  before the rest of the originally-planned test coverage was
  implemented. That reviewer's other findings (the
  `vi.spyOn(usePatternSvgUrl, ...)` technique's build-tool risk, and a
  preference for the DOM-level `.print-page` count as the primary
  multi-page assertion over the PDF-byte regex) were both incorporated:
  the spy technique was verified directly (written, then proven to fail
  against a deliberately-broken wiring, then restored) rather than trusted
  on faith, and the e2e PDF page-count check is explicitly framed as a
  secondary confirmation alongside the primary DOM-level assertion. A
  second independent, fresh-context `general-purpose` subagent then
  reviewed the finished diff (all commits up to that point, plus a live
  `npm run verify` and e2e run it performed itself rather than trusting
  the docs) and found the second, deeper "Actual project size" crash —
  every prior test in this stage, including the first reviewer's fix and
  its regression test, used typical-size patterns (30x20cm, 60x40cm,
  80x60cm), so the tiny-pattern margin/overlap path went unexercised.
  This was independently re-verified live (not just trusted) before being
  fixed as its own atomic commit with its own regression tests at the
  unit, component, and e2e levels — all confirmed to fail against the
  pre-fix code first.
- **`docs/LIMITATIONS.md` updated**: a new product-level entry states
  plainly that the app cannot verify a real printer/driver honors
  "actual size" printing — the "5cm scale check" square and its ruler
  guidance (item 21) are exactly this stage's answer to a limitation that
  cannot be automated away, and this session's manual PDF verification
  confirms the _app's own output_ is correct at true scale, which is as
  far as an automated check can ever go.
- **No `docs/DECISIONS.md` entry was added.** This stage made no new
  product/design decision — the punch-guide-in-print behavior was already
  decided in Stage C and found to already work correctly, and the
  "Actual project size" fix is a straightforward bug fix (an omitted
  function argument), not a design call.
- **Verification**: `npm run verify` (format + lint + typecheck + test +
  build) green, 196/196 unit/component tests passing (28 files, up from
  187/28 at the Stage C baseline — 9 new tests across
  `svgPattern.test.ts`, `printTiling.test.ts`, and `ExportPanel.test.tsx`).
  `npm run test:e2e` green on both the `chromium` and `mobile-narrow`
  (WebKit) projects, 17/17 tests total (10 pre-existing across the rest of
  the suite + 7 new in the net-new `e2e/print-emulation.spec.ts`; the
  WebKit project runs 16 of those 17, correctly skipping the
  Chromium-only PDF-render test).

## 18. Stage E — what was actually built (as Iteration 03 Round 2)

Stage E was never implemented as its own dedicated stage in this
repository: its open-ended "polish" audit was superseded, before it ran to
completion, by the product owner's 13-point Iteration 03 feedback (see
`docs/ITERATION_03_PLAN.md`), which took priority and shipped first as
Iteration 03 Round 1. Two of Stage E's own findings — a camera-framing bug
in `src/three/viewport.ts` and a mobile-narrow layout overflow on Preview —
were not covered by that feedback and were carried forward explicitly in
`docs/ITERATION_03_PLAN.md`'s "Cross-reference: Iteration 02's own Stage E
survey" section as still-open. **This repository's own text never actually
contained a written Stage E findings section** (only the forward references
above, "Stage E remains unstarted" / "Stage E untouched"), so — per this
project's rule against silently guessing on a thin spec — this section
records what those two carried-forward findings actually turned out to be
on fresh re-verification against the post-Round-1 codebase, alongside three
further real bugs found in the same pass, all fixed together as
**Iteration 03 Round 2** (branch `feat/iteration-03-round-2`).

Every item below was re-investigated against the current code before a fix
was proposed, not assumed correct from the original framing — Round 1
significantly changed several of the files this round touches
(`PreviewStage.tsx`, `ExportPanel.tsx`, `Legend.tsx`, `Viewport3D.tsx`/
`viewport.ts`).

1. **Camera framing wastes most of the canvas on flat/wide relief models —
   confirmed as-is, fixed as originally proposed.** `fitOrthographicCamera`
   framed the camera to an isotropic bounding-sphere radius, which a
   flat/wide bas-relief model wastes most of the frame against (the
   sphere's radius is inflated by the view's depth axis, which never
   appears on screen). Also discovered in the same investigation: the same
   mismatched-frustum issue silently stretched the actual depth _capture_
   (the capture render target is always square; the on-screen frustum
   isn't) — a real output-quality bug, not just a display one. Round 1's
   new model-straightening rotation controls (`Viewport3D.tsx`) turned out
   not to change the diagnosis (a bounding sphere's radius is
   rotation-invariant, so the isotropic-fit waste is orthogonal to whether
   a model is tilted), but they _do_ need the camera to re-fit after a
   rotation change, which the fix now does. See `docs/DECISIONS.md` for the
   `projectedHalfExtent`/`fitOrthographicCameraToExtent` implementation.
2. **Preview breaks at the project's own mobile-narrow viewport —
   confirmed still present post-Round-1, fixed as originally proposed.**
   Round 1 deleted the Export panel's duplicate controls and the
   calibration section (both real changes to the overflow math), but the
   root cause — Preview's pattern/simulation two-column layout using an
   inline `display: grid, gridTemplateColumns: '1fr 1fr'` style with no
   responsive fallback, unlike every other two-column layout in the app —
   was untouched by either change and still reproduced at 390px width, with
   the Export & print `<summary>` toggle genuinely unclickable in that
   state (confirmed by a real Playwright click, not just a visibility
   check). Fixed by converting to a `.preview-columns` class with the same
   `@media (max-width: 720px)` pattern `.app-shell`/`main.relief-layout`
   already use.

   > **Closing note (post-Iteration-03 usability audit).** A separate,
   > later-reported 375px-width overflow (`scrollWidth: 420` vs
   > `clientWidth: 375`) raised the same "mobile overflow" question a
   > third time, after Iteration 03's combined-workspace change replaced
   > `.preview-columns` entirely. That report was investigated
   > specifically (not conflated with this already-fixed item) and turned
   > out to require an additional precondition this item's fix never
   > covered: the small-region warning banner actively showing. A
   > different, real bug was found once that precondition was actually
   > reproduced against a real CI environment (not just a local one) —
   > `.workspace-rail-heading`'s live-status pill had no way to wrap onto
   > a second line at narrow widths. See `docs/DECISIONS.md`'s "Workspace
   > usability fixes" section, item 5, for the full reproduction,
   > root-cause, and fix — that question is now closed with real
   > measurements from both a local build and CI, not left open.

3. **The Legend table has no horizontal-scroll wrapper — confirmed, fixed
   as originally proposed.** The `CalibrationEditor` table half of the
   original finding is moot (Round 1 removed calibration from the UI
   entirely). `Legend.tsx`'s `.legend-table` is now wrapped in a
   `.legend-table-wrap` (`overflow-x: auto`) container.
4. **Region labels overlap and become unreadable in thin/small regions —
   confirmed, new work (not part of the original Stage E framing, found on
   fresh re-verification).** `buildLabels` in `src/export/svgPattern.ts`
   placed every qualifying region's label at its centroid unconditionally,
   with no collision avoidance between neighboring labels — small/thin
   regions routinely produced stacked, illegible labels, undermining
   CLAUDE.md's "never rely on color alone" requirement in practice even
   though a label was technically drawn. Fixed with a new pure,
   deterministic collision-avoidance pass — see `docs/DECISIONS.md` for the
   chosen strategy and the alternatives considered.
5. **No automated axe-core accessibility run had ever been executed —
   closed.** `docs/LIMITATIONS.md` recorded this gap as an environment
   limitation (no browser available in the sandbox that built the MVP), not
   a product decision. Added `@axe-core/playwright` and
   `e2e/accessibility.spec.ts`, sweeping Import (both before and after a
   model loads), Relief, Height levels, Yarn colors, and Preview (including
   the opened Export & print panel) against WCAG 2.0/2.1 A/AA and
   best-practice rules. **Result: zero real violations found**, on both the
   `chromium` and `mobile-narrow` (WebKit) projects — see
   `docs/LIMITATIONS.md` for the closure note.

**Verification**: `npm run verify` (format + lint + typecheck + test +
build) green; `npm run test:e2e` green on both the `chromium` and
`mobile-narrow` (WebKit) projects, including the new mobile-overflow
regression test and the full axe-core sweep. See the PR for this branch for
the exact test counts and both independent review passes' findings.
