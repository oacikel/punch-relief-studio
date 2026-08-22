# User Guide

Punch Relief Studio turns a 3D model into a punch-needle pattern with both
yarn-color regions and pile-height regions, plus a simulated preview of the
finished textile. Everything runs in your browser -- nothing you import or
create ever leaves your device.

## The two steps

As of Iteration 03's combined-workspace change, the app is two steps, not a
page-by-page wizard: **Import** a model, then work in one persistent
**Workspace** -- a control rail alongside a live-updating preview, modeled
on 3D-print slicer software, where every adjustment shows its effect
immediately without navigating anywhere.

1. **Import** -- pick one of the three built-in samples (no upload needed),
   or drag in your own STL or OBJ (+ .mtl + local texture images, all at
   once). Once a model is loaded, an orientation section appears on this
   same page: rotate/pan/zoom to the viewpoint you want. Only what's visible
   from this one viewpoint becomes the pattern; back and hidden surfaces are
   not captured (see the in-app note on this step). If the model itself
   isn't aligned upright, use the "Straighten model" Roll/Pitch/Yaw sliders
   (next to the standard-view buttons) to rotate the model itself -- not
   just the view -- before generating the relief; "Reset rotation" clears
   all three back to zero. (These same rotation controls are also available
   later, from the Workspace's Finished-piece simulation panel -- see
   below; both copies control the same rotation.) Click "Continue to
   Workspace" when you're happy with the view.

2. **Workspace** -- a control rail on the left, a live preview on the
   right, both always visible. There's no "Generate relief" button: as
   soon as a model is loaded, a relief starts generating automatically,
   and it re-generates automatically whenever you change a setting that
   affects it (a small "● Live — updates as you adjust" indicator at the
   top of the rail briefly shows "● Processing…" while a change is being
   applied). The rail's groups, top to bottom:

   - **Needle & pile**: how many distinct pile heights the pattern uses
     ("Number of pile heights", 2-12), with a live readout directly below
     it showing what percentage of the pattern each height level actually
     covers once a relief has generated (e.g. `H1 17.7%  H2 13.4%  ...`).
   - **Punch detail**: "Smallest punchable region" -- pick "Fine detail",
     "Balanced" (the default), or "Bold & simple" to control how
     aggressively tiny, fiddly areas get removed. There's no separate
     detail-resolution control to tune; the app uses a fixed sampling
     resolution internally. A warning appears here if any region ends up
     too small to punch reliably.
   - **Shape interpretation**: "Relief depth", "Smoothing", and "Raise near
     surfaces" (which end of the model becomes the tallest pile); "Height
     band spacing" and "Keep edges crisp", behind an "Advanced shape
     controls" disclosure.
   - **Yarn colors**: choose single-color, color-by-height, or (when the
     model has material/texture data) source-material color extraction,
     and edit swatches/names. In color-by-height mode, a small "Color
     story palettes" gallery lets you apply a hand-picked color collection
     (e.g. Terrain, Coastal) to all swatches in one click -- you can still
     hand-edit any swatch afterward. Changing colors updates the pattern
     and simulation instantly -- it never triggers a relief regeneration.
   - **Export & print**: set the physical project size, export SVG/PNG/
     print-PDF, and save/load project settings as JSON. This always
     matches whatever the Pattern panel (see below) is currently showing
     on screen -- there's nothing to set twice.

   The preview column, pinned in place alongside the rail while you scroll
   on wider screens, shows two panels at once:

   - **Pattern**: compare pattern views (combined/color-only/height-only/
     contour), toggle Grid/Mirrored (back side)/Region labels
     (C1-H1 etc.), and add an optional "Punch guide" (None/Dots) -- an
     evenly spaced grid of dots at a spacing (in cm) you choose, as a rough
     placement guide. This is the spacing you set, not a measurement of
     your printer's actual output; always check the printed scale-check
     square with a ruler before punching. The same guide and view settings
     are used both on screen and in every SVG/PNG/print export.
   - **Finished-piece simulation**: your actual yarn colors on a simulated
     pile texture (loop or cut), with an adjustable lighting direction and
     the same Roll/Pitch/Yaw "Straighten model" controls from Import --
     adjusting rotation here re-generates the relief too, since it changes
     what the app actually captured from the model, not just this preview.

   Below both panels, a legend ties color IDs, height IDs, and yarn names
   together, with a symbol as well as a color for every region so nothing
   ever depends on color alone to tell regions apart.

You can move backward and forward between Import and Workspace without
losing your settings.

## About needle-setting calibration

Punch Relief Studio computes height levels as relative low-to-high bands,
and does not currently show a needle-setting/calibration UI anywhere in the
app -- that surface was removed by an explicit, reversible product
decision, since most crafters using this tool have adjustable-needle tools
where relative height order is what actually matters. The underlying
calibration engine still exists and is fully tested; if you need it back,
that's a product decision to revisit, not a missing feature to work around.

## Printing

"Print / Save as PDF" uses your browser's native print dialog. Always
check the printed scale-check square with a ruler before cutting fabric --
some print dialogs silently rescale to "fit page", which would throw off
your physical dimensions.

## Privacy

Your model, textures, and patterns stay on your device. There is no
account, no upload, and no analytics.
