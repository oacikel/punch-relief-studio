interface Props {
  modelLabel: string | null;
  onChangeModel: () => void;
}

/**
 * Ambient "current model" indicator, replacing the former `StageNav`
 * sidebar (docs/ITERATION_03_PLAN.md's Workspace two-column redesign).
 * Modeled deliberately on how 3D-print slicer software shows the loaded
 * file's name alongside an always-available "Open" action, rather than
 * framing swapping models as "going back a step" in a wizard -- the
 * combined Workspace already collapsed Import/Workspace to two stages, and
 * re-adding step-navigation chrome here would reintroduce the wizard
 * mental model this redesign is deliberately moving away from. See
 * docs/DECISIONS.md for the full reasoning.
 *
 * `modelLabel` is deliberately NOT derived here -- it's `App.tsx`'s
 * existing `sourceKind`/`sampleId`/`sourceFilename`-based computation,
 * already built for `ImportStage`'s collapsed-picker summary, passed
 * through as a prop rather than duplicated.
 */
export function ModelBar({ modelLabel, onChangeModel }: Props): JSX.Element {
  return (
    // `role="region"` + `aria-label`: axe-core's "region" best-practice
    // rule (found via this feature's own e2e accessibility sweep) requires
    // all page content to be contained by a landmark -- this bar sits as a
    // plain sibling of `<header>`/`<main>`, outside both.
    <div className="model-bar" role="region" aria-label="Loaded model">
      <p className="model-bar__label">
        Model: <strong>{modelLabel ?? 'untitled'}</strong>
      </p>
      <button type="button" onClick={onChangeModel}>
        Change
      </button>
    </div>
  );
}
