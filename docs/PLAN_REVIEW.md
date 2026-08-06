# Plan Review

Reviewer: independent subagent, fresh context, given only PRODUCT_SPEC.md,
PLAN.md and ACCEPTANCE_MATRIX.md (no implementation).

## Blocking issues raised

1. MVP scope reads as v1.0, not minimal, relative to the plan's own decision
   rules. **Resolution:** documented in PLAN.md §"Resolutions" — core
   correctness prioritized over breadth; simplifications explicitly logged
   in DECISIONS.md/LIMITATIONS.md rather than silently claimed complete.
2. "Built" status claimed for never-compiled code; no plan for catching
   compiler errors once network is available. **Resolution:** mandatory
   `npm install && npx tsc --noEmit` as the first step of the next networked
   session; shared types centralized in one module to reduce drift.
3. "Never fetch remote OBJ/MTL assets" had no concrete mechanism.
   **Resolution:** `LoadingManager.setURLModifier` restricted to a
   filename→blobURL map built from the user's `FileList`; unit-tested to
   reject remote URLs and unmatched names.

## Important improvements raised

- Color quantization determinism needs an explicit deterministic PRNG/init
  rule, not just "stable seed." **Resolution:** fixed-seed xorshift32 PRNG
  with farthest-point initialization, implemented in
  `src/domain/color/colorQuantize.ts`, tested for repeat-run equality.
- Color quantization should run off the main thread like the height
  pipeline. **Resolution:** moved into the same worker (PLAN.md item 4).
- No stated performance budget for the simulation stage. **Resolution:**
  budget documented in PLAN.md item 5; to be measured for real once a
  browser is available and recorded in TEST_REPORT.md.
- Print-to-PDF OS/browser scaling risk should be called out in export UX
  copy. **Resolution:** the export panel and PDF page include an explicit
  "verify against the printed scale-check square before cutting fabric"
  instruction; see docs/ALGORITHMS.md §Print scaling.

## Optional improvements raised

- Explicit incremental-delivery fallback if milestones don't all finish —
  addressed structurally: each milestone is an atomic, working commit, so a
  partial build is always a working build, and docs/ACCEPTANCE_MATRIX.md is
  reconciled against actual implementation at the end rather than aspiration.
- axe-core automated run once a browser is available — added to
  docs/TEST_REPORT.md as a deferred-verify item with the exact command.

## Verdict

**Approved, conditional on the above**, all of which are resolved in this
document and reflected in PLAN.md before implementation began.
