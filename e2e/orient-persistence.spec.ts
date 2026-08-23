import { expect, test, type Page } from '@playwright/test';

/**
 * Usability fix #2 (docs/DECISIONS.md): on Import, the 3D orient viewport
 * used to render (in DOM/visual order) *after* the "Orient the model"
 * heading/explanation/"Continue to Workspace" button, so at a realistic
 * window size the button was reachable long before the viewport ever
 * scrolled into view -- a user could click through without ever seeing or
 * rotating the model they were meant to orient. Fixed by moving
 * `ImportOrientSection` to a new JSX slot rendered *after* the (otherwise
 * untouched) `Viewport3D` block in `App.tsx`, a real DOM reorder rather
 * than a CSS `order` trick, chosen specifically because it keeps DOM/
 * visual/tab order all in agreement (CSS `order` would have left tab
 * order at the old position, a real keyboard-user mismatch). This does
 * not touch Viewport3D's own JSX slot, so it doesn't affect the no-remount
 * guarantee the rest of this file exercises.
 *
 * Follow-up fix (same file, later commit): the reorder above wasn't
 * sufficient on its own -- `ImportStage`'s sample cards + drop zone stayed
 * fully rendered at their full ~700px height even after a model had
 * loaded, which is what was actually pushing the viewport (and the
 * "Continue to Workspace" button even further) below the fold. Fixed by
 * collapsing that picker behind a closed `<details>` once `hasModel` is
 * true (see ImportStage.tsx).
 *
 * Real before/after measurement at 1440x900 after loading Concentric
 * Ripple (values from manual verification, not asserted verbatim below
 * since exact pixel values are sensitive to font metrics):
 *   - .viewport-container top:  929.6px (bug) -> 723px (reorder only) -> ~272px (this fix)
 *   - "Orient the model" top:                     1713px (reorder only) -> ~1260px (this fix)
 *   - "Continue to Workspace" top:                1835px (reorder only) -> ~1381px (this fix)
 * The viewport -- the thing a user actually needs to see to orient the
 * model -- is now comfortably above the fold. The heading/button remain
 * below the fold at this window height because `Viewport3D`'s own
 * "Standard views" + "Straighten model" controls (shown on Import) are
 * tall in their own right -- that's pre-existing height unrelated to the
 * picker regression this fix targets, so this test doesn't demand it be
 * eliminated, only that it not regress back toward the broken numbers
 * above.
 */
test('the 3D orient viewport lands near the top on Import, and the Continue button is not pushed further down by the sample picker', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByText('Concentric Ripple').click();
  await expect(page.getByRole('heading', { name: 'Orient the model' })).toBeVisible();

  const viewportTop = await page
    .locator('.viewport-container')
    .evaluate((el) => el.getBoundingClientRect().top);
  const headingTop = await page
    .getByRole('heading', { name: 'Orient the model' })
    .evaluate((el) => el.getBoundingClientRect().top);
  const continueTop = await page
    .getByRole('button', { name: 'Continue to Workspace' })
    .evaluate((el) => el.getBoundingClientRect().top);

  // The viewport must be visible without scrolling (or very close to the
  // fold) -- and, just as importantly, must appear *before* the Continue
  // button in visual order, so a user can't reach "Continue" without the
  // viewport having already scrolled into view first.
  expect(viewportTop).toBeLessThan(900);
  expect(viewportTop).toBeLessThan(continueTop);

  // The heading/button must land well above where they sat with the
  // sample picker fully expanded (1713px / 1835px) -- a real, generous
  // margin below those broken values, so a regression back to "picker
  // never collapses" is caught, without over-asserting on Viewport3D's own
  // (pre-existing, out-of-scope-here) control height.
  expect(headingTop).toBeLessThan(1500);
  expect(continueTop).toBeLessThan(1600);
});

/**
 * Companion coverage for the same follow-up fix: once a model has loaded,
 * the "Try a built-in sample" cards and "Or import your own" drop zone
 * collapse behind a closed `<details>` disclosure (ImportStage.tsx) instead
 * of staying fully expanded, which is what was consuming the ~700px that
 * pushed the viewport/CTA below the fold in the first place. This does not
 * remove the ability to import a *different* model -- the disclosure stays
 * reachable via its one-line summary, and reopening it must still let the
 * user pick a different sample.
 */
test('the sample picker collapses once a model loads, and can be reopened to load a different model', async ({
  page,
}) => {
  await page.goto('/');

  // Before any model is loaded, the picker is open and the cards are the
  // ones actually clicked to load a model.
  const picker = page.locator('details.import-picker');
  await expect(picker).toHaveJSProperty('open', true);
  await page.getByText('Concentric Ripple').click();
  await expect(page.getByRole('heading', { name: 'Orient the model' })).toBeVisible();

  // Once loaded, the picker collapses and a one-line summary names what's
  // loaded, instead of the cards/drop-zone staying fully expanded.
  await expect(picker).toHaveJSProperty('open', false);
  await expect(page.getByText(/Model loaded: Concentric Ripple/)).toBeVisible();

  // Reopening it and picking a different sample must still actually work --
  // this is the "don't just delete the re-import path" requirement.
  await page.getByText(/choose a different file/i).click();
  await expect(picker).toHaveJSProperty('open', true);
  await page.getByText('Geometric Steps').click();
  await expect(page.getByText(/Model loaded: Geometric Steps/)).toBeVisible();
});

/**
 * Regression test for a bug found via manual testing: App.tsx used to
 * render two separate <Viewport3D> instances -- one inside OrientStage,
 * one inside ReliefStage -- so navigating from "Orient" to "Create relief"
 * unmounted and remounted the 3D viewport, silently discarding whatever
 * camera orientation the user had just chosen and resetting to the
 * default 'front' view. Fixed by rendering a single, persistent Viewport3D
 * shared by both stages.
 *
 * As of Iteration 03's combined-workspace change (docs/ITERATION_03_PLAN.md
 * #13), "Create relief" is no longer a separate stage -- it's part of the
 * single "Workspace" stage, whose control rail auto-regenerates live (no
 * manual "Generate relief" button -- see src/hooks/useLiveRelief.ts). This
 * spec now exercises the same shared-Viewport3D persistence guarantee
 * across Import -> Workspace, waiting for the live pill to settle instead
 * of clicking a button.
 *
 * Updated again for the Workspace two-column redesign (docs/DECISIONS.md):
 * the former H1/H2/... coverage-percentage chip row (used here both as a
 * "generation landed" readiness signal and as proof the level count
 * genuinely changed) was removed. Replaced with the "Color by height"
 * swatch table, kept in exact 1:1 sync with the generated level count by
 * `resizeSwatches`/`PROCESSING_SUCCEEDED` (src/state/appState.ts) -- a
 * genuine, not approximate, readiness+count signal. The chips' own
 * per-level percentage breakdown (used previously to also assert the
 * regenerated pattern had a real, non-degenerate distribution across
 * bands, not just a level count) has no direct UI replacement now that
 * the feature is gone -- that narrower claim is dropped here; the domain
 * logic it exercised (`quantize()`'s "Balanced by shape" mode) remains
 * covered by unit tests (src/domain/__tests__/quantize.test.ts).
 */
test('camera orientation chosen on Import carries over to relief generation', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Concentric Ripple').click();
  await expect(page.getByRole('heading', { name: 'Orient the model' })).toBeVisible();

  await page.getByRole('button', { name: 'top', exact: true }).click();

  await page.getByRole('button', { name: 'Continue to Workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Workspace' })).toBeVisible();

  // Live regeneration auto-fires on arrival (no manual "Generate relief"
  // button anymore). Switching to "Color by height" doubles as the wait
  // for the first pass to land -- the default 4 swatch rows only appear
  // once the first relief has actually finished generating.
  await page.getByLabel('Color by height').check();
  await expect(page.locator('.legend-table tbody tr')).toHaveCount(4, { timeout: 15_000 });

  // Labels/grouping updated in Iteration 02 Stage B -- see
  // docs/ITERATION_02_PLAN.md §5. "Height band spacing" (formerly
  // "Quantization mode") now lives behind the "Advanced shape controls"
  // disclosure, so it must be opened before the select is reachable.
  await page.getByLabel(/Number of pile heights/).fill('8');
  await page.getByText('Advanced shape controls').click();
  await page.getByLabel('Height band spacing').selectOption('quantile');

  // The swatch table growing to 8 rows is the proof the regeneration
  // actually completed with the new level count, not just that the
  // control accepted the input.
  await expect(page.locator('.legend-table tbody tr')).toHaveCount(8, { timeout: 15_000 });
});

/**
 * Iteration 03 Round 1 (docs/ITERATION_03_PLAN.md #5): model-straightening
 * rotation (Roll/Pitch/Yaw) added to Viewport3D. As of the combined-
 * workspace change, rotation state was lifted out of Viewport3D's local
 * component state into AppState (`modelRotationDeg`), so both Import's
 * Viewport3D and Workspace's SimulationPanel render controlled
 * `RotationControls` instances bound to the *same* value (see
 * docs/DECISIONS.md) -- this is a stronger guarantee than the original
 * "same DOM instance never remounts" trick: any component reading the
 * shared state sees the current value regardless of its own mount/unmount
 * history. This test locks in that setting rotation on Import is visible
 * from Workspace's own copy of the controls.
 *
 * Updated for the Workspace two-column redesign (docs/DECISIONS.md):
 * Workspace's own `RotationControls` copy lives inside `SimulationPanel`,
 * which -- unlike the pre-redesign stacked layout -- is only mounted while
 * the "Finished-piece simulation" tab is active (Pattern is the default
 * active tab). The tab switch itself doesn't affect the underlying
 * `AppState.modelRotationDeg` value, so clicking into the tab is just
 * navigation to where the already-carried-over value is rendered, not a
 * new precondition being tested.
 */
test('model rotation chosen on Import carries over to the Workspace', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Concentric Ripple').click();
  await expect(page.getByRole('heading', { name: 'Orient the model' })).toBeVisible();

  const rollInput = page.getByLabel(/^Roll/);
  await rollInput.fill('45');
  await rollInput.blur();
  await expect(rollInput).toHaveValue('45');

  await page.getByRole('button', { name: 'Continue to Workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Workspace' })).toBeVisible();

  await page.getByRole('button', { name: 'Finished-piece simulation' }).click();
  await expect(page.getByLabel(/^Roll/)).toHaveValue('45');
});

test('"Reset rotation" zeroes all three axes', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Concentric Ripple').click();
  await expect(page.getByRole('heading', { name: 'Orient the model' })).toBeVisible();

  await page.getByLabel(/^Roll/).fill('30');
  await page.getByLabel(/^Pitch/).fill('-15');
  await page.getByLabel(/^Yaw/).fill('90');

  await page.getByRole('button', { name: 'Reset rotation' }).click();

  await expect(page.getByLabel(/^Roll/)).toHaveValue('0');
  await expect(page.getByLabel(/^Pitch/)).toHaveValue('0');
  await expect(page.getByLabel(/^Yaw/)).toHaveValue('0');
});

/**
 * Fetches the pattern `<img>`'s current `blob:` URL and returns its actual
 * SVG text content -- not just the URL string. `usePatternSvgUrl.ts`
 * creates a fresh `blob:` object URL on every mount of the hook,
 * regardless of whether the underlying `regionMap` genuinely changed, so
 * comparing URLs alone is not a reliable "did the pattern actually
 * regenerate" signal once `PatternPanel` itself unmounts and remounts
 * (e.g. switching away to another tab and back) -- confirmed by testing
 * that a bare tab round-trip with no setting change in between still
 * produces a different `src` value. Comparing the actual fetched *content*
 * is not fooled by this: an unmount/remount with an unchanged `regionMap`
 * still serializes to byte-identical SVG text, while a real regeneration
 * (different region shapes) does not.
 */
async function patternSvgContent(page: Page): Promise<string | null> {
  return page.evaluate(async () => {
    const img = document.querySelector(
      'img[alt^="Punch-needle pattern"]',
    ) as HTMLImageElement | null;
    if (!img?.src) return null;
    const response = await fetch(img.src);
    return response.text();
  });
}

/**
 * New coverage for the combined-workspace change: rotation adjusted
 * directly from Workspace's own SimulationPanel controls (not just
 * Import's) must genuinely affect the live-regenerated relief, not be a
 * purely cosmetic control -- the same guarantee `captureDepth` always had,
 * now proven from its new home too (see docs/DECISIONS.md's "Wrinkle A"
 * resolution).
 *
 * Updated for the Workspace two-column redesign (docs/DECISIONS.md): the
 * former H1/H2/... coverage-percentage chip row (used here to detect that
 * regeneration produced different content) was removed, and rotation
 * controls now live behind the "Finished-piece simulation" tab rather than
 * always being visible, which means proving the effect requires navigating
 * away from the Pattern tab and back. An earlier version of this test
 * compared the Pattern `<img>`'s `src` attribute before/after, which turned
 * out to be a tautology once found by independent review: `PatternPanel`
 * unmounts on every tab switch, and `usePatternSvgUrl.ts` creates a fresh
 * `blob:` URL on every mount regardless of whether `regionMap` actually
 * changed -- the src would differ after a bare tab round-trip even with no
 * rotation change at all, so the old test could never fail. Fixed by
 * comparing the actual fetched SVG *content* (`patternSvgContent` above)
 * instead of the URL -- an unmount/remount with unchanged content
 * serializes identically, so this only passes on a genuine regeneration.
 */
test("rotating the model from Workspace's own controls changes the live-regenerated pattern", async ({
  page,
}) => {
  await page.goto('/');
  await page.getByText('Concentric Ripple').click();
  await page.getByRole('button', { name: 'Continue to Workspace' }).click();

  // Pattern is the default active tab -- its <img> is visible without any
  // extra navigation. Waiting for it also confirms the initial live
  // generation has finished (no separate idle status pill to wait on).
  const patternImg = page.getByAltText(/Punch-needle pattern/);
  await expect(patternImg).toBeVisible({ timeout: 15_000 });
  const before = await patternSvgContent(page);
  expect(before).not.toBeNull();

  // Switch to the Finished-piece simulation tab, where Workspace's own
  // rotation controls live -- both Import's and Workspace's copies share
  // an accessible name ("Pitch ..."), so scope to the one visible copy
  // (only Workspace's is mounted while on the Workspace stage -- Import's
  // is unmounted, not just hidden, per docs/DECISIONS.md).
  await page.getByRole('button', { name: 'Finished-piece simulation' }).click();

  // Uses Pitch, not Roll: the "Concentric Ripple" fixture is radially
  // symmetric around the view axis, so a pure Roll (rotation around that
  // same axis) produces byte-identical captured depth -- correct model
  // behavior, not a bug, but a poor choice for proving rotation has an
  // effect. Pitch tilts the model relative to the camera, which changes
  // the depth capture for any shape, symmetric or not.
  const pitchInput = page.getByLabel(/^Pitch/);
  await pitchInput.fill('45');
  await pitchInput.blur();

  // Switch back to Pattern and poll for its rendered content to actually
  // change, rather than the live pill -- the debounce+regeneration can
  // complete fast enough between polls that a pill-based wait could
  // trivially pass without ever observing the in-flight state. This
  // asserts the *effect* (the pattern actually regenerated with different
  // content), which is what this test is really checking.
  await page.getByRole('button', { name: 'Pattern' }).click();
  await expect.poll(() => patternSvgContent(page), { timeout: 15_000 }).not.toBe(before);
});
