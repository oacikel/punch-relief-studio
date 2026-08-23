# Iteration 04 — Needle-Geometry Width Constraint

Status: **approved by product owner via direct chat discussion (2026-08-23,
not a written proposal round-trip) — implementing directly, no further
sign-off gate.** This doc records the resulting model and design for the
same reason every other iteration plan does: so the reasoning survives past
the conversation that produced it.

## 1. Problem

The pattern-generation pipeline currently has no concept of the physical
punch needle at all — `minRegionPreset` (docs/ITERATION_03_PLAN.md #1)
floors region size as a percentage of raster area, deliberately independent
of any physical unit, because it runs before the app has any calibrated
notion of a real needle. But a real needle has two physical properties that
constrain what's actually punchable:

- **Diameter** — how wide the needle's shaft is. A region narrower than a
  few needle-widths can't hold its shape as a distinct punched zone; loops
  physically overlap into a blob.
- **Throw / shaft length** — how far the needle can push, which caps how
  tall a loop can be. Shorter loops leave more of the backing fabric exposed
  per row, so a design that's both narrow _and_ short-piled needs to be
  proportionally wider to read as a clean, distinct shape once punched.

Per the product owner (own punching experience, needle throw ~4cm, of which
roughly half is practically usable as loop height): shorter loops need a
noticeably wider minimum region (given as-example ~3x the needle diameter);
taller loops can be as narrow as ~1x the diameter. This is one continuous
relationship, not two independent knobs.

A separate craft technique — double-passing a line (punching it twice,
offset) so it reads continuous on the fabric's reverse side — was
considered and explicitly **descoped from this feature**: the product owner
does not want the app to expose punch-technique instructions. The
compensation already happens implicitly, because the same short-loop
condition that would call for a double pass is exactly what widens the
minimum-region floor. The floor absorbs the effect; there is no separate
"requires double pass" flag anywhere in the code or UI.

## 2. Model

Two new user inputs, entered directly in mm (no calibration-profile
plumbing — the product owner is deferring that to a future, more general
"user model" concept; see `docs/DECISIONS.md`):

- `diameterMm` — needle shaft diameter.
- `throwMm` — needle's maximum shaft/throw length.

Both default to `0`, which means **disabled** — no existing pattern's
output changes until a user deliberately enters real numbers. This matters
for the same honesty reason `minRegionPreset` never assumed a physical
value it didn't have: a `0` is not "a needle with zero diameter," it's "no
needle-geometry constraint configured yet."

Derived, per pile-height level (`src/domain/pattern/needleGeometry.ts`):

```
minLoopHeightMm = diameterMm                    // can't loop shorter than the needle itself
maxLoopHeightMm = throwMm * PRACTICAL_THROW_FRACTION   // default 0.5, "roughly half of it"
loopHeightMm(level i of N) = minLoopHeightMm +
  (maxLoopHeightMm - minLoopHeightMm) * (i / (N - 1))   // linear across levels, i=0..N-1

t = clamp((loopHeightMm(i) - minLoopHeightMm) / (maxLoopHeightMm - minLoopHeightMm), 0, 1)
widthMultiplier(i) = MULT_SHORT - (MULT_SHORT - MULT_TALL) * t   // MULT_TALL=1, MULT_SHORT=2.5
minWidthMm(i) = widthMultiplier(i) * diameterMm
```

`MULT_SHORT = 2.5` is a placeholder inside the product owner's own "somewhere
between 1x and 3x, I'll adjust as I get more experience" range — a
deliberately-approximate constant, not measured. It is **not** exposed as a
tunable control in this iteration (see §6); the product owner can ask for
that once they've actually used the feature and know what to change it to.
Changing it later is a one-line edit to a named constant, not a schema
change.

Degenerate input guard: if `throwMm * PRACTICAL_THROW_FRACTION <=
diameterMm` (an invalid/too-small throw for the given diameter), the range
collapses — `loopHeightMm`/`minWidthMm` fall back to the most conservative
case (`t = 0`, i.e. `MULT_SHORT`) rather than dividing by zero or producing
a smaller-than-intended floor.

## 3. Enforcement: shapes the pattern, not a warning

Per explicit product-owner correction: this is **not** a warning users have
to notice and act on manually — the generated `RegionMap` must already
satisfy the constraint. This reuses the existing tiny-region merge mechanism
(`cleanupTinyRegions`, `src/domain/regionCleanup.ts`), generalized to accept
a **per-level** threshold instead of one flat number
(`cleanupTinyRegionsByLevel`), since `minWidthMm` varies by pile height.

The needle-driven floor and the existing `minRegionPreset` floor are
independent concerns (arbitrary detail-resolution floor vs. physical
needle/loop-height floor) and both apply — the effective per-level
threshold is `max(minRegionPresetPx, needleDrivenPxForThatLevel)`.

> **RESOLVED (post-ship correction, same day).** The paragraph below
> originally shipped this as a known, deferred simplification. The
> product owner then found it produce a visibly wrong result on a real
> detailed model ("even if the individual height levels work, the
> combined area view would still need to obey our region rules") — fixed
> immediately rather than left deferred. `cleanupTinyRegionsByLevel`/
> `minWidthAreaPxForLevel` (referenced below and in §4) were removed
> entirely and replaced by `applyNeedleWidthOpening`/
> `chebyshevDistanceTransform`, a genuine per-level local-thickness check.
> See `docs/DECISIONS.md`'s "Needle-width floor: from area check to
> local-thickness opening" for the full account.

**Known simplification, carried over from `minRegionPreset`'s own
precedent:** this checks connected-component _pixel area_, not true local
width/thickness. A long, thin, elongated region can pass an area check while
still having a cross-section narrower than the floor somewhere along its
length — the same shape class already flagged as a known limitation for
region-label placement (docs/DECISIONS.md, Iteration 03 Round 2 #4). A
proper fix would be a morphological-erosion-based local-thickness check
(disk kernel = half the minimum width) instead of an area count. Not
attempted this iteration — flagged in `docs/LIMITATIONS.md` rather than
silently accepted.

## 4. Architecture: physical dimensions become a regeneration trigger

Converting `minWidthMm` to a pixel threshold needs pixels-per-cm, which
needs `AppState.patternDimensions` (`widthCm`/`heightCm`). That value is
live app state already (not export-only), but until now it was deliberately
_not_ threaded into the Worker's relief-generation pipeline (see
`minRegionPreset`'s own doc comment for why: the pipeline used to have no
physical scale to convert against). This feature breaks that decoupling on
purpose, per explicit product-owner sign-off: **editing the pattern's
physical Width/Height now triggers the same live-regeneration cycle pile
height count already does**, joining `useLiveRelief`'s trigger list
alongside `reliefSettings`/`rotationDeg`. Confirmed acceptable — physical
size was always an independent user choice, not tied to the model, so this
doesn't introduce a new coupling to the model itself, just a new
regeneration trigger.

Data flow:

- `AppState.needleGeometry: NeedleGeometry` (new field, default `{diameterMm:
0, throwMm: 0}`), `SET_NEEDLE_GEOMETRY` action.
- `useLiveRelief`'s effect dependency array gains `needleGeometry` and
  `patternDimensions` (by reference, same pattern as existing deps).
- `ProcessArgs`/`ProcessRequest` (`useProcessingWorker.ts`,
  `processing.worker.ts`) gain `needleGeometry` and `patternDimensions:
{widthCm, heightCm}` fields, passed straight through from `App.tsx`'s
  `buildProcessArgs`.
- Inside the worker, after computing `levels` and the existing
  `minRegionPx`, compute a per-level px width via `minWidthPxForLevel(...)`
  and call `applyNeedleWidthOpening` for **`heightIndex` only** (see the
  RESOLVED note above) — this is a pile-height concept, so it does not
  apply to `colorIndex`'s own (unchanged) flat-threshold cleanup pass.

## 5. UX

Two new numeric fields ("Needle diameter (mm)", "Needle throw / shaft
length (mm)") in the **Needle & Pile** rail group
(`src/components/workspace/ReliefControls.tsx`), next to the existing pile-
height-count slider — the group is already named for exactly this. No new
warning banner, no per-level chip annotation, no "double pass" indicator
anywhere in the UI, per the product owner's explicit "the pattern's width
will be information enough."

## 6. Explicitly deferred (not this iteration)

- Tunable UI for `PRACTICAL_THROW_FRACTION` / the 1x–2.5x multiplier range —
  named constants for now; revisit once the product owner has hands-on
  experience with what actually needs adjusting.
- Any tie-in to `CalibrationProfile` — product owner's stated intent is a
  future, more general "user model" for this kind of physical-tool data;
  these two fields are a deliberate stepping stone, kept structurally
  separate so migrating them later is a data move, not a rewrite.
- True local-thickness (morphological erosion) checking instead of area.
- Backend/server-side execution of any of this — current build stays fully
  client-side per CLAUDE.md; noted only as a heads-up for future direction.

## 7. Persistence

`needleGeometry` is added to `ProjectFile`
(`src/domain/projectSchema.ts`) as an **optional** top-level field, no
`PROJECT_SCHEMA_VERSION` bump — same precedent as `punchGuide` (Iteration 02
Stage C): a single additive, safely-defaulted (`{diameterMm: 0, throwMm:
0}`, i.e. "disabled") field, loaded via `??` at `handleLoadProjectJson`
time, so pre-Iteration-04 project JSON still parses unchanged.

## 8. Test plan

- `src/domain/pattern/__tests__/needleGeometry.test.ts` — loop-height/min-
  width formulas across level counts, the degenerate-range guard, the
  disabled (`0,0`) case.
- `src/domain/__tests__/regionCleanup.test.ts` — new cases for
  `chebyshevDistanceTransform` and `applyNeedleWidthOpening` (see the
  RESOLVED note above), including a hand-verified thin-spike-off-a-large-
  blob regression case; existing `cleanupTinyRegions` behavior/tests
  untouched.
- `src/hooks/__tests__/useLiveRelief.test.ts` — new case confirming a
  `needleGeometry`/`patternDimensions` change alone (no `reliefSettings`
  change) still triggers regeneration.
- `src/components/workspace/__tests__/ReliefControls.test.tsx` — new fields
  render, call `onChange` correctly, default to blank/zero.
- Full `npm run typecheck && npm run lint && npm run test` before treating
  this as done, per CLAUDE.md — this environment has `node_modules`
  installed and working network-independent tooling, unlike the original
  MVP build (`docs/LIMITATIONS.md`), so there's no excuse to skip it.
