import { expect, test } from '@playwright/test';

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
 */
test('camera orientation chosen on Import carries over to relief generation', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Concentric Ripple').click();
  await expect(page.getByRole('heading', { name: 'Orient the model' })).toBeVisible();

  await page.getByRole('button', { name: 'top', exact: true }).click();

  await page.getByRole('button', { name: '2. Workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Workspace' })).toBeVisible();

  // Live regeneration auto-fires on arrival (no manual "Generate relief"
  // button anymore) -- wait for the first pass to actually land before
  // reading a snapshot to diff against below.
  await expect(page.locator('.level-chip').first()).toBeVisible({ timeout: 15_000 });
  const before = await page.locator('.level-chip').allTextContents();

  // Labels/grouping updated in Iteration 02 Stage B -- see
  // docs/ITERATION_02_PLAN.md §5. "Height band spacing" (formerly
  // "Quantization mode") now lives behind the "Advanced shape controls"
  // disclosure, so it must be opened before the select is reachable.
  await page.getByLabel(/Number of pile heights/).fill('8');
  await page.getByText('Advanced shape controls').click();
  await page.getByLabel('Height band spacing').selectOption('quantile');

  // Poll for the chip list to actually change (8 chips instead of the
  // default's 4, at minimum) rather than the live pill -- see the
  // rotation test below for why polling the real effect is more robust
  // than the pill for a debounce that can settle between assertions.
  await expect(page.locator('.level-chip')).toHaveCount(8, { timeout: 15_000 });
  const chips = await page.locator('.level-chip').allTextContents();
  expect(chips).not.toEqual(before);
  const nonZeroBands = chips.filter((text) => !/ 0\.0%$/.test(text.trim())).length;
  expect(nonZeroBands).toBeGreaterThan(2);
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
 */
test('model rotation chosen on Import carries over to the Workspace', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Concentric Ripple').click();
  await expect(page.getByRole('heading', { name: 'Orient the model' })).toBeVisible();

  const rollInput = page.getByLabel(/^Roll/);
  await rollInput.fill('45');
  await rollInput.blur();
  await expect(rollInput).toHaveValue('45');

  await page.getByRole('button', { name: '2. Workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Workspace' })).toBeVisible();

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
 * New coverage for the combined-workspace change: rotation adjusted
 * directly from Workspace's own SimulationPanel controls (not just
 * Import's) must genuinely affect the live-regenerated relief, not be a
 * purely cosmetic control -- the same guarantee `captureDepth` always had,
 * now proven from its new home too (see docs/DECISIONS.md's "Wrinkle A"
 * resolution).
 */
test("rotating the model from Workspace's own controls changes the live-regenerated pattern", async ({
  page,
}) => {
  await page.goto('/');
  await page.getByText('Concentric Ripple').click();
  await page.getByRole('button', { name: '2. Workspace' }).click();
  await expect(page.getByText(/Live — updates as you adjust/)).toBeVisible({ timeout: 15_000 });

  const before = await page.locator('.level-chip').allTextContents();

  // Workspace's own rotation controls live in the Finished-piece
  // simulation panel -- both Import's and Workspace's copies share an
  // accessible name ("Pitch ..."), so scope to the one visible copy (only
  // Workspace's is mounted while on the Workspace stage -- Import's is
  // unmounted, not just hidden, per docs/DECISIONS.md). Uses Pitch, not
  // Roll: the "Concentric Ripple" fixture is radially symmetric around
  // the view axis, so a pure Roll (rotation around that same axis)
  // produces byte-identical captured depth -- correct model behavior, not
  // a bug, but a poor choice for proving rotation has an effect. Pitch
  // tilts the model relative to the camera, which changes the depth
  // capture for any shape, symmetric or not.
  const pitchInput = page.getByLabel(/^Pitch/);
  await pitchInput.fill('45');
  await pitchInput.blur();

  // Poll directly on the chip text changing rather than the live pill --
  // the debounce+regeneration can complete fast enough between polls that
  // a pill-based wait could trivially pass without ever observing the
  // in-flight state. This asserts the *effect* (the pattern actually
  // changed), which is what this test is really checking.
  await expect(page.locator('.level-chip')).not.toHaveText(before, { timeout: 15_000 });
});
