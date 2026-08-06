interface Props {
  children: React.ReactNode;
}

/**
 * Orient stage: the 3D viewport itself is rendered by the parent (App)
 * since it's shared with the Relief stage -- this component supplies the
 * stage's framing text, most importantly the single-viewpoint /
 * undercuts limitation the product spec requires be visible in the UI,
 * not just in docs.
 */
export function OrientStage({ children }: Props): JSX.Element {
  return (
    <section className="stage-panel" aria-labelledby="orient-heading">
      <h2 id="orient-heading">Orient the model</h2>
      <p className="helper-text">
        Rotate, pan, and zoom to choose the viewpoint the pattern will be generated from. Only the
        surface visible from this single viewpoint becomes the pattern -- occluded and back surfaces
        are not captured, so undercuts and hidden detail will not appear in the result. This is a
        front-view bas-relief interpretation, not a full 3D reconstruction.
      </p>
      {children}
    </section>
  );
}
