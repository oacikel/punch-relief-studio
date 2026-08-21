# Cowork Handoff

Canonical continuation point for the next Cowork session (or, for this
specific milestone, the "code mode" Claude Code session finishing delivery
-- see "Delivery blocker" below). Read this before re-reading the whole
repo. Kept concise per the house rule: this is not a transcript.

## Current product state

**Milestone completed: Stage A (workflow simplification), implemented and
locally verified, not yet pushed/merged/deployed.**

- Visible workflow is now 5 stages: **Import → Create Relief → Height
  Levels → Yarn Colors → Preview**. The former separate **Orient** and
  **Export** stages are gone from navigation.
- Orient's content (3D viewport, standard-view buttons, the single-
  viewpoint/no-undercuts honesty copy) now renders on **Import**, once a
  model has loaded, right below the sample-picker/drag-drop UI. A "Continue
  to Create Relief →" button advances to Relief. The 3D viewport is still
  one persistent `Viewport3D` instance shared between Import and Relief (as
  it was between Orient and Relief before), so re-orienting never resets on
  navigation.
- Export's content (physical dimensions, pattern view, print-labels
  toggle, page size, SVG/PNG/print/project-JSON actions, the calibration
  editor) now lives in a collapsed **"Export & print"** `<details>` panel
  at the bottom of **Preview**, so Preview isn't a wall of controls.
  Underlying logic is untouched -- `ExportPanel.tsx` (renamed/moved from
  `ExportStage.tsx`, no longer under `components/stages/` since it's not a
  workflow stage) reuses `CalibrationEditor` and the export/print helpers
  exactly as before.
- No architectural changes: `src/domain/**`, `src/three/**`,
  `src/workers/**`, `src/export/**`, `src/persistence/**` were not touched.
  Everything Stage A did lives in `src/components/**`,
  `src/state/workflow.ts`, `src/styles.css`, and docs.
- No migration logic was added for the old `orient`/`export` stage values.
  Verified (see `docs/ITERATION_02_PLAN.md` §2.2) that workflow stage is
  pure in-memory state -- never in `localStorage`, never in the persisted
  `ProjectFile` schema, no router/URL -- so there is no real data path that
  could ever produce those values post-Stage-A. `WORKFLOW_STAGES` is simply
  the 5-item list now.
- Real print-safety fix included: Preview and the relocated export panel
  now share one DOM tree during print (they never did before, since Export
  and Preview were separate, mutually-exclusive stages). Preview's normal
  on-screen content is wrapped in a `.screen-only` div; `@media print` in
  `src/styles.css` now hides `.screen-only` alongside `.app-header`/
  `.stage-nav`/`.export-panel`/`.export-controls`. Verified with Chromium's
  print-media emulation and an actual print-to-PDF render (see
  "Verification" below) -- output is the pattern, crop marks, page numbers,
  and the 5cm scale-check square, nothing else.

## Git state

- Repository: `https://github.com/oacikel/punch-relief-studio`
- Branch: **`feat/ux-iteration-02-stage-a`**, checked out locally in this
  Cowork session's sandbox at `/home/claude/punch-relief-studio` (not on
  the user's machine or on GitHub yet -- see "Delivery blocker").
- Base: branched from `main` @ `642294a` ("feat: make printed region labels
  optional").
- 4 commits on top of `main`, working tree clean at HEAD:
  1. `64cdf8f` docs: add Iteration 02 plan (UX audit, Stage A-E roadmap)
  2. `8a09556` feat: merge Orient into Import and Export into Preview (Stage A)
  3. `c8880aa` test: update unit/e2e tests for the 5-stage workflow
  4. `dd19ac7` docs: reflect the 5-stage workflow in product/architecture docs
- HEAD: `dd19ac73a5047fceba7ea0eb174cc2c9bcc63ba7`
- **Not merged. Not pushed. No PR opened.** See below.

## Delivery blocker (read this before starting Stage B)

This Cowork cloud session's git proxy refused `git push` with: _"access
denied by the git proxy: oacikel/punch-relief-studio is not in this
session's authorized repository set... add the repository to the session's
sources."_ Same restriction applies to the GitHub REST/GraphQL API (`gh
api`, `gh repo view` all 403 with "GitHub access to this repository is not
enabled for this session. Use add_repo to request access."). No `add_repo`
tool/command is exposed in this sandbox. Researched during the session:
this matches a currently-open, unresolved upstream issue
(`anthropics/claude-code#76248`) reporting the exact same error for Cowork
desktop sessions specifically, with no documented self-service fix as of
this session. The user confirmed a regular Claude Code ("code mode")
session on their own machine does not have this restriction (their own git
credentials apply there).

**Resolution reached with the user:** finish and verify Stage A entirely in
this Cowork session (done -- see Verification below), then hand the user a
self-contained prompt to paste into a Claude Code session that has real
GitHub access, so that session can pick up this exact branch and finish
push → PR → merge → deploy verification. That prompt was delivered to the
user directly in this session's final report (not duplicated here). If
you're a fresh Cowork session picking this up instead: check first whether
the branch already exists on `origin` (it may already be pushed/merged by
the code-mode session) before assuming this blocker still applies.

## Deployment

**Not deployed.** Blocked entirely on the push/PR/merge step above --
nothing has reached GitHub yet, so the GitHub Actions deploy workflow
(`.github/workflows/deploy.yml`, triggers on push to `main`) has not run
for this change. `https://oacikel.github.io/punch-relief-studio/` still
serves whatever was last deployed from `main` @ `642294a`, i.e. the
pre-Stage-A 7-stage app. Once merged, the next fresh session (or the user)
should confirm the Pages deployment actually picked up the new commit
before telling the user it's live -- don't assume a successful merge means
deployed.

## Verification (all run in this Cowork sandbox, on HEAD `dd19ac7`)

| Check                                                       | Result                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify` (format + lint + typecheck + test + build) | **all green**                                                                                                                                                                                                                                                                               |
| `npm run test`                                              | 137/137 passing, 23 files (was 134/23 at baseline; +3 new `ImportOrientSection` tests)                                                                                                                                                                                                      |
| `npm run build`                                             | succeeds (pre-existing chunk-size advisory only, not an error)                                                                                                                                                                                                                              |
| `npm run test:e2e` (chromium project)                       | 3/3 passing -- `main-workflow.spec.ts`, `orient-persistence.spec.ts`, `import-fixture.spec.ts`, all rewritten for the 5-stage nav and the new "Export & print" disclosure                                                                                                                   |
| `mobile-narrow` (webkit) e2e project                        | untestable in this sandbox -- no webkit binary available (only a Chromium build ships in the base image), not a code issue. Whoever runs this next in a normal environment (CI included) should get a real webkit result.                                                                   |
| Print-safety fix                                            | verified twice: Chromium print-media emulation screenshot + an actual `page.pdf()` render, both from the Preview stage with the Export & print panel left **collapsed** (the harder case) -- output shows only the pattern/crop-marks/scale-check, no app chrome, no leaked Preview content |

**Playwright/Chromium version note for whoever runs e2e next:** this
sandbox's pinned Chromium build (`/opt/pw-browsers/chromium-1194`) is older
than what `@playwright/test@1.62.1` (the version `npm install` resolves,
despite `package.json` pinning `^1.48.0`) expects by default, and this
sandbox has no network path to `cdn.playwright.dev` to fetch a matching
one. Worked around locally by temporarily adding
`launchOptions.executablePath` to the `chromium` project in
`playwright.config.ts` for each verification run, then reverting the file
before committing (never committed this workaround -- check
`git diff playwright.config.ts` is empty before trusting this doc). A
normal CI/dev environment shouldn't hit this at all.

## User testing checkpoint

Once this branch is deployed, the product owner should manually check:

1. Fresh load → does the app open on "1. Import" with no "Orient" or
   "Export" entries in the left nav (5 items total)?
2. Pick a built-in sample → does a 3D preview + "Orient the model" section
   appear on the same Import page, below the sample picker? Rotate/pan/zoom
   it, click a standard-view button (e.g. "top"), then click "Continue to
   Create Relief →" -- does the chosen orientation actually carry over
   (relief generation reflects the rotated view, not the default front)?
3. Generate a relief, walk through Height Levels → Yarn Colors → Preview
   normally -- everything should feel unchanged.
4. On Preview, confirm the pattern + simulation + legend are visible
   without opening anything, then click "▶ Export & print" -- does it
   expand to show dimensions, pattern view, page size, the four export
   buttons, and the calibration editor, all still working (try Export SVG,
   Print/Save as PDF, Save project JSON)?
5. Print or "Print / Save as PDF" from Preview with the Export & print
   panel left collapsed -- does the output show only the pattern (with
   scale-check square), not the app UI or the collapsed panel's label?
6. Resize the browser narrow (~400px) on Import and Preview -- does layout
   stay usable?
7. Refresh the browser mid-workflow -- does it cleanly reset to Import
   (expected -- workflow state was never persisted, before or after this
   change) rather than erroring?

## Feedback status

- **Resolved this session:** feedback items 1 (remove Orient stage) and 19
  (remove Export stage) -- both fully implemented in Stage A.
- **Corrected, not just resolved:** feedback item 20 (the print/PDF bug) --
  investigation found this was already fixed on `main` before this session
  started (commit `56e276e`), verified directly; Stage A's own risk (the
  Preview/Export DOM-merge print leak) was caught by independent review and
  fixed as part of this same milestone, not deferred.
- **Deferred to Stage B (by design, per the original plan):** items 2
  (Relief terminology/IA), 10 (orientation-control polish), 11 (12 height
  levels), 12 (needle visual), 13 (contextual calibration access). The
  Relief-control UX audit informing Stage B is already written --
  `docs/ITERATION_02_PLAN.md` §5.
- **Deferred to Stage C:** items 14 (label toggle on Preview itself, not
  just export), 15-18 (punch-dot guide, physical spacing, density).
- **Deferred to Stage D:** item 21-22 (print requirements, print
  architecture review) -- scope is now "harden and extend a working
  pipeline," not "fix a broken one," per the corrected understanding above.
- **Newly discovered, not previously flagged by the product owner:** the
  Cowork-session GitHub push restriction (see "Delivery blocker"). Not a
  product feedback item, but blocks calling this milestone fully delivered
  until a session with real GitHub access finishes push → PR → merge →
  deploy.
- **Unresolved:** none within Stage A's own scope.

## Next milestone

**First:** whoever has GitHub access needs to push `feat/ux-iteration-02-stage-a`,
open a PR against `main`, confirm CI is green (`.github/workflows/ci.yml` --
note this sandbox couldn't run the real `npx playwright install --with-deps
chromium webkit` CI does, so CI running for the first time on this branch is
this branch's first true cross-browser signal), merge, and confirm the
GitHub Pages deploy actually picked up the new commit.

**Then, Stage B (Relief workspace redesign)** -- only after the product
owner has tested Stage A on the deployed app and given feedback:

- Reorganize Relief-stage controls using the UX audit already written in
  `docs/ITERATION_02_PLAN.md` §5 (Needle & Pile / Punch Detail / Shape
  Interpretation groupings, Basic vs. "Advanced shape controls" disclosure,
  plain-language labels/helper text per control).
- Extend height levels from 3-8 to 2-12 (`src/domain/quantize.ts`'s
  `RangeError` bound, the Relief-stage slider, and -- this is the sharp
  edge -- `CalibrationEditor.tsx` currently has **no add/remove-needle-
  setting UI at all**, only edit-in-place on whatever `createDefaultProfile()`
  returns (4 settings). Supporting 12 levels usefully needs that gap closed
  first or worked around; see plan §10.
- Decide calibration's permanent home (stays in Preview's Export panel vs.
  a real Settings surface, plus the product owner's requested contextual
  "Calibrate needle" link from Heights) -- open decision, plan §14.
- Consider orientation-control polish (icon/gumball vs. text buttons) if it
  doesn't delay the above -- low priority per the original brief.

Do not start Stage B implementation before the product owner has actually
tested the deployed Stage A build and given feedback, per the hard
one-milestone-per-session rule.

## Important decisions

- **No Fable this session.** The `Agent` tool's `model: "fable"` returned
  "out of usage credits" on the one attempt (UX audit task). Per the
  brief's own fallback rule, this session's Sonnet did the analysis/plan/
  review split itself instead (self-authored plan → independent fresh-
  context Sonnet review of the plan → independent fresh-context Sonnet
  review of the finished implementation). Full detail in
  `docs/ITERATION_02_PLAN.md` §1. **Next session should retry Fable
  first** -- it may be back -- and should say plainly whether it was
  available.
- **No alias/migration layer for old stage names**, despite the original
  brief asking for one -- proven unnecessary (see "Git state" above and
  plan §2.2/§0.1). Don't re-add this "for safety" in a later session
  without re-checking that reasoning; it was a deliberate simplification,
  not an oversight.
- **Print architecture unchanged from what was already decided** (native
  `window.print()` + print stylesheet, documented in `docs/DECISIONS.md`
  "No bundled PDF library for print export") -- Stage A only fixed the new
  DOM-merge risk it introduced, it did not revisit that architectural
  choice. Stage D's "print architecture review" should still happen per
  the original brief, but go in expecting to harden/extend, not replace.
- **`ExportPanel.tsx` lives in `src/components/`, not
  `src/components/stages/`** -- deliberate, since `ARCHITECTURE.md`
  documents stage components as 1:1 with workflow stages, and Export
  hasn't been one since this session. Keep this convention if Stage B/C
  add more non-stage shared panels.
