interface Props {
  onDismiss: () => void;
}

/**
 * EXP-004 ("Show a first-project guide after import"): a short, dismissible
 * callout shown once, the first time a visitor's project reaches Workspace,
 * naming the same three rail steps (`EDITOR_STEPS` in Workspace.tsx) they're
 * about to work through -- hypothesis being that first-time visitors who
 * know what's coming are more likely to reach export instead of stalling on
 * step one. Purely presentational -- `App.tsx` owns the "should this be
 * visible" state and localStorage persistence (`firstProjectGuideStore.ts`),
 * consistent with this component tree's existing controlled-component
 * convention (see e.g. `patternViewSettings`/`onPatternViewSettingsChange`).
 */
export function FirstProjectGuide({ onDismiss }: Props): JSX.Element {
  return (
    <div className="first-project-guide" role="note">
      <div className="first-project-guide__body">
        <p className="eyebrow">New here?</p>
        {/* `h2`, not `h3` -- this renders immediately before the rail's own
            `<h2>Make it punchable</h2>` (Workspace.tsx), as a sibling
            section, not a subsection of it. A `h3` here would skip a level
            in reading order (`h1` app title -> this -> `h2`), which axe's
            `heading-order` rule flags (e2e/accessibility.spec.ts). */}
        <h2>Three short steps to your first pattern</h2>
        <ol>
          <li>
            <strong>Shape</strong> -- set pile height, detail, and physical size.
          </li>
          <li>
            <strong>Yarn</strong> -- choose how many colors and where they go.
          </li>
          <li>
            <strong>Export</strong> -- download or print, ready to punch.
          </li>
        </ol>
        <p className="helper-text">
          The preview on the right updates live as you go, so you can see each change before you
          commit to it.
        </p>
      </div>
      <button type="button" className="first-project-guide__dismiss" onClick={onDismiss}>
        Got it
      </button>
    </div>
  );
}
