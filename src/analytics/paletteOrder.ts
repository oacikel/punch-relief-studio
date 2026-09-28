/**
 * EXP-002 ("move yarn palette selection earlier") assignment.
 *
 * Hypothesis: choosing yarn colors before tuning depth/shape may reduce
 * unfinished patterns. `Workspace.tsx` normally orders its three setup
 * steps Shape -> Yarn -> Export; the `earlier` variant swaps the first two
 * to Yarn -> Shape -> Export.
 *
 * Self-assigns 50/50, the same way as a link-provided experiment -- writing
 * into the sessionStorage slot `source.ts` already caches landing
 * experiment context in, so `track()` attaches `experimentRef: 'EXP-002'`
 * + `variant` to every product event with no change at any call site and
 * no new event names.
 *
 * Unlike a purely additive self-assigned experiment (new copy, a new panel
 * with nothing else depending on it), this one reorders existing, numbered
 * steps that plenty of other surface area -- button labels ("2 Yarn"), e2e
 * specs, screenshots -- already assumes a fixed position for. So, an
 * **unassigned session defaults to `control`** (today's order), not to the
 * treatment. The reorder only ever appears for a session actually enrolled
 * in the measurement, keeping every other surface's existing behaviour
 * intact until there is a real assignment to honour. See docs/DECISIONS.md.
 *
 * Two scoping decisions, both recorded in docs/DECISIONS.md:
 *
 * 1. **A link-provided experiment always wins.** If the landing URL already
 *    put an experiment in the cache, EXP-002 does not overwrite it.
 * 2. **Session-scoped, not visitor-scoped.** The variant lives in
 *    sessionStorage alongside the rest of the landing context, so a
 *    returning visitor can land in the other variant on a later visit.
 */
import { generateRandomId } from '@/analytics/ids';
import { getCachedExperiment, writeExperimentContext } from '@/analytics/source';

/** The one place this experiment's ref is spelled out. */
export const PALETTE_ORDER_EXPERIMENT_REF = 'EXP-002';

export type PaletteOrderVariant = 'control' | 'earlier';

/** Both variant slugs satisfy the contract's `VARIANT_PATTERN`; asserted in
 * `__tests__/paletteOrder.test.ts` so a future rename can't quietly produce
 * a value the ingest server rejects the whole event for. */
export const PALETTE_ORDER_VARIANTS: readonly PaletteOrderVariant[] = ['control', 'earlier'];

/** 50/50 from the parity of the first hex digit of a fresh random ID --
 * reuses `generateRandomId`'s crypto-preferring source rather than adding a
 * second notion of randomness. Takes the hex string as an argument so tests
 * can pin a variant instead of retrying until chance cooperates. */
export function pickPaletteOrderVariant(
  randomHex: string = generateRandomId(),
): PaletteOrderVariant {
  const firstDigit = Number.parseInt(randomHex.slice(0, 1), 16);
  if (!Number.isFinite(firstDigit)) return 'control';
  return firstDigit % 2 === 0 ? 'control' : 'earlier';
}

/**
 * Enrolls this session in EXP-002 unless it is already in some experiment
 * (see decision 1 above). Called from `initAnalytics()` immediately after
 * `captureLandingContext()`, under the same guards -- analytics configured
 * and Global Privacy Control absent -- so an unconfigured build still
 * writes no storage keys at all.
 */
export function assignPaletteOrderExperiment(
  storage: Storage = window.sessionStorage,
  variant: PaletteOrderVariant = pickPaletteOrderVariant(),
): void {
  const existing = getCachedExperiment(storage);
  if (existing.experimentRef !== undefined) return;
  writeExperimentContext({ experimentRef: PALETTE_ORDER_EXPERIMENT_REF, variant }, storage);
}

/**
 * The variant this session is in, for the UI to branch on. Returns
 * `control` -- today's Shape-then-Yarn order -- whenever the session isn't
 * enrolled in EXP-002: analytics unconfigured (no assignment ever
 * happened), a Global Privacy Control session, a link that put the session
 * in a different experiment, or simply having landed in the `control` half
 * of this one.
 */
export function getPaletteOrderVariant(
  storage: Storage = window.sessionStorage,
): PaletteOrderVariant {
  const { experimentRef, variant } = getCachedExperiment(storage);
  if (experimentRef !== PALETTE_ORDER_EXPERIMENT_REF) return 'control';
  return PALETTE_ORDER_VARIANTS.find((candidate) => candidate === variant) ?? 'control';
}
