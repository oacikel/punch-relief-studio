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
2. **Create relief** -- adjust height levels (3-8), relief intensity,
   smoothing, edge preservation, minimum region size, output resolution, and
   quantization mode, then click "Generate relief". This runs in the
   background so the rest of the app stays responsive.
3. **Height levels** -- see how much of the pattern each level covers and
   which needle setting it maps to, plus a warning if any region is too
   small to punch reliably.
4. **Yarn colors** -- choose single-color, color-by-height, or (when the
   model has material/texture data) source-material color extraction, and
   edit swatches/names.
5. **Preview** -- compare pattern views (combined/color-only/height-only/
   contour) against the finished-piece simulation, and read the legend that
   ties color IDs, height IDs, yarn names, and needle settings together.
   Open the "Export & print" panel on this page to set the physical project
   size, export SVG/PNG/print-PDF, save project settings as JSON, and manage
   your calibration profile (including a printable calibration strip).

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

## Printing

"Print / Save as PDF" uses your browser's native print dialog. Always
check the printed scale-check square with a ruler before cutting fabric --
some print dialogs silently rescale to "fit page", which would throw off
your physical dimensions.

## Privacy

Your model, textures, patterns, and calibration data stay on your device.
There is no account, no upload, and no analytics.
