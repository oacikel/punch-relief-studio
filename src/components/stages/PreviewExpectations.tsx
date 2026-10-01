/**
 * EXP-003's treatment: what the pattern will and won't contain, stated on the
 * Import/Orient step -- while the model is still on screen and turnable, and
 * before the Workspace preview exists at all.
 *
 * The app has always been honest that its output is a single-viewpoint
 * bas-relief interpretation rather than a full 3D reconstruction (CLAUDE.md's
 * standing constraint), but until now as one line of helper text next to
 * "Create my pattern" -- read as reassurance, not as a specification. The
 * hypothesis EXP-003 tests is that the confusion this causes surfaces later,
 * at export, when the sheet turns out to be one flat view of one side: by
 * then the expectation has already been formed and the export looks broken
 * rather than expected.
 *
 * So each line below names a concrete thing the person will see in the
 * exported sheet, paired with the action still available to them here
 * (rotating the model), and the closing line ties the two together: the
 * export is this view. It replaces the one-line helper text rather than
 * stacking on top of it -- saying the same thing twice, once vaguely, is how
 * the vague version gets skipped. No dismiss control: this is a step's own
 * copy, not a hint overlaying someone else's controls.
 */
const EXPECTATIONS: Array<{ label: string; text: string }> = [
  {
    label: 'This one view',
    text: 'Only the surfaces facing you above become the pattern. The back and anything hidden behind them do not — turn the model now if you want a different side.',
  },
  {
    label: 'A few flat heights',
    text: 'Smooth depth is rounded into a handful of pile-height steps labelled H1, H2, … — relative steps, not millimetres.',
  },
  {
    label: 'No undercuts',
    text: 'Anything tucked underneath or behind another surface merges into the surface in front of it.',
  },
];

export function PreviewExpectations(): JSX.Element {
  return (
    <section className="preview-expectations" aria-labelledby="preview-expectations-heading">
      <p className="eyebrow">Before you preview</p>
      <h3 id="preview-expectations-heading">What your pattern will show</h3>
      <ul className="preview-expectations__list">
        {EXPECTATIONS.map((item) => (
          <li key={item.label}>
            <strong>{item.label}</strong> — {item.text}
          </li>
        ))}
      </ul>
      <p className="helper-text">
        What you export is this same single view, flattened: one side of the model as a punchable
        sheet, not a full 3D reconstruction.
      </p>
    </section>
  );
}
