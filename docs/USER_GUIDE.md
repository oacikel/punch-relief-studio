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
   not captured (see the in-app note on this step). Click "Continue to
   Create Relief" when you're happy with the view.
2. **Create relief** -- controls are grouped by what they actually affect:
   - **Needle & pile**: how many distinct pile heights the pattern uses
     ("Number of pile heights", 2-12).
   - **Punch detail**: "Smallest punchable region" (removes fiddly tiny
     areas); "Detail resolution", behind an "Advanced punch detail
     controls" disclosure, for how finely the shape is sampled.
   - **Shape interpretation**: "Relief depth", "Smoothing", and "Raise near
     surfaces" (which end of the model becomes the tallest pile); "Height
     band spacing" and "Keep edges crisp", behind an "Advanced shape
     controls" disclosure.

   Click "Generate relief" when you're happy with the settings -- this runs
   in the background so the rest of the app stays responsive. The 3D
   preview stays visible alongside the controls (pinned in place while you
   scroll, on wider screens) so you can see the effect of a change without
   scrolling back up.

3. **Height levels** -- see how much of the pattern each level covers and
   which needle setting it maps to, plus a warning if any region is too
   small to punch reliably. A "Calibrate needle settings" link takes you
   straight to the calibration editor on the Preview step (see
   "Calibration" below) if your profile isn't calibrated yet, or you want
   to add/remove needle settings.
4. **Yarn colors** -- choose single-color, color-by-height, or (when the
   model has material/texture data) source-material color extraction, and
   edit swatches/names.
5. **Preview** -- compare pattern views (combined/color-only/height-only/
   contour) against the finished-piece simulation, and read the legend that
   ties color IDs, height IDs, yarn names, and needle settings together. A
   "Region labels (C1-H1 etc.)" checkbox controls whether the on-screen
   pattern shows those ids -- independent of the separate "Print region
   labels" checkbox in the export panel below, which only affects what
   actually prints. A "Punch guide" selector (None/Dots) adds an optional
   grid of evenly spaced dots at a spacing (in cm) you choose, as a rough
   placement guide -- the same guide setting is used both on screen and in
   every SVG/PNG/print export, so what you see in Preview is what prints.
   This is the spacing you set, not a measurement of your printer's actual
   output; always check the printed scale-check square with a ruler before
   punching. Open the "Export & print" panel on this page to set the
   physical project size, export SVG/PNG/print-PDF, save project settings
   as JSON, and manage your calibration profile (including a printable
   calibration strip).

You can move backward and forward through these steps without losing your
settings.

## Calibration

The default profile is explicitly **uncalibrated** -- it only tells you
relative low-to-high order, not real measurements. To get real numbers:
print the calibration strip (in the Export & print panel on Preview), punch
each labeled block on scrap fabric with the corresponding needle setting,
measure the pile height with a ruler, and enter the measurements back into
the profile. Save the profile so it's remembered next time (stored locally
in your browser; export it as JSON to back it up or move it to another
device).

You can add or remove needle settings from a profile (1-12 per profile,
matching the 2-12 range of pile heights a pattern can use) with the "Add
needle setting"/"Remove" controls in the calibration editor -- most needles
only have a handful of real settings, so a profile isn't padded with unused
rows by default. The calibration editor lives in the "Export & print"
panel on Preview; the "Calibrate needle settings" link on the Height
Levels step jumps there directly and opens it for you.

## Printing

"Print / Save as PDF" uses your browser's native print dialog. Always
check the printed scale-check square with a ruler before cutting fabric --
some print dialogs silently rescale to "fit page", which would throw off
your physical dimensions.

## Privacy

Your model, textures, patterns, and calibration data stay on your device.
There is no account, no upload, and no analytics.
