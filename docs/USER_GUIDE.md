# User Guide

Punch Relief Studio turns a 3D model into a punch-needle pattern with both
yarn-color regions and pile-height regions, plus a simulated preview of the
finished textile. Everything runs in your browser -- nothing you import or
create ever leaves your device.

## The five steps

1. **Import** -- pick one of the three built-in samples (no upload needed),
   or drag in your own STL or OBJ (+ .mtl + local texture images, all at
   once). Once a model is loaded, an orientation section appears on this
   same page: rotate/pan/zoom to the viewpoint you want. Only what's visible
   from this one viewpoint becomes the pattern; back and hidden surfaces are
   not captured (see the in-app note on this step). If the model itself
   isn't aligned upright, use the "Straighten model" Roll/Pitch/Yaw sliders
   (next to the standard-view buttons) to rotate the model itself -- not
   just the view -- before generating the relief; "Reset rotation" clears
   all three back to zero. Click "Continue to Create Relief" when you're
   happy with the view.
2. **Create relief** -- controls are grouped by what they actually affect:
   - **Needle & pile**: how many distinct pile heights the pattern uses
     ("Number of pile heights", 2-12).
   - **Punch detail**: "Smallest punchable region" -- pick "Fine detail",
     "Balanced" (the default), or "Bold & simple" to control how
     aggressively tiny, fiddly areas get removed. There's no separate
     detail-resolution control to tune; the app uses a fixed sampling
     resolution internally.
   - **Shape interpretation**: "Relief depth", "Smoothing", and "Raise near
     surfaces" (which end of the model becomes the tallest pile); "Height
     band spacing" and "Keep edges crisp", behind an "Advanced shape
     controls" disclosure.

   Click "Generate relief" when you're happy with the settings -- this runs
   in the background so the rest of the app stays responsive. The 3D
   preview stays visible alongside the controls (pinned in place while you
   scroll, on wider screens) so you can see the effect of a change without
   scrolling back up.

3. **Height levels** -- see how much of the pattern each level covers, plus
   a warning if any region is too small to punch reliably.
4. **Yarn colors** -- choose single-color, color-by-height, or (when the
   model has material/texture data) source-material color extraction, and
   edit swatches/names. In color-by-height mode, a small "Color story
   palettes" gallery lets you apply a hand-picked color collection (e.g.
   Terrain, Coastal) to all swatches in one click -- you can still hand-edit
   any swatch afterward.
5. **Preview** -- compare pattern views (combined/color-only/height-only/
   contour) against the finished-piece simulation (now shown in your actual
   yarn colors, not a flat placeholder), and read the legend that ties color
   IDs, height IDs, and yarn names together. A "Region labels (C1-H1 etc.)"
   checkbox controls whether the pattern shows those ids -- this is the
   _only_ label control; export/print always match it, along with the
   current pattern view, grid, and mirrored state, so there's nothing to
   set twice. A "Punch guide" selector (None/Dots) adds an optional grid of
   evenly spaced dots at a spacing (in cm) you choose, as a rough placement
   guide -- the same guide setting is used both on screen and in every
   SVG/PNG/print export. This is the spacing you set, not a measurement of
   your printer's actual output; always check the printed scale-check
   square with a ruler before punching. Open the "Export & print" panel on
   this page to set the physical project size, export SVG/PNG/print-PDF,
   and save/load project settings as JSON.

You can move backward and forward through these steps without losing your
settings.

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
