import { expect, test } from '@playwright/test';

/**
 * Regression test for a bug found via manual testing: App.tsx used to
 * render two separate <Viewport3D> instances -- one inside OrientStage,
 * one inside ReliefStage -- so navigating from "Orient" to "Create relief"
 * unmounted and remounted the 3D viewport, silently discarding whatever
 * camera orientation the user had just chosen and resetting to the
 * default 'front' view. Fixed by rendering a single, persistent Viewport3D
 * shared by both stages. As of Iteration 02 Stage A, "Orient" is no longer
 * a separate workflow stage -- its content (and the shared viewport) now
 * renders on "Import" once a model has loaded (see
 * docs/ITERATION_02_PLAN.md) -- this test now exercises that same
 * persistence guarantee across Import -> Relief instead of Orient -> Relief.
 *
 * This can only be verified in a real browser: choosing 'top' vs the
 * default 'front' for the ripple sample changes which surface the depth
 * capture sees, which changes how many height bands end up with real
 * pixels. If the camera silently reset to 'front', only 1-2 of 8 quantile
 * bands would have any pixels (confirmed manually); with 'top' correctly
 * applied, several distinct bands do.
 */
test('camera orientation chosen on Import carries over to relief generation', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Concentric Ripple').click();
  await expect(page.getByRole('heading', { name: 'Orient the model' })).toBeVisible();

  await page.getByRole('button', { name: 'top', exact: true }).click();

  await page.getByRole('button', { name: '2. Create relief' }).click();
  await expect(page.getByRole('heading', { name: 'Create the relief' })).toBeVisible();

  await page.getByLabel(/Height levels/).fill('8');
  await page.getByLabel('Quantization mode').selectOption('quantile');
  await page.getByRole('button', { name: 'Generate relief' }).click();
  await expect(page.getByRole('heading', { name: 'Height levels' })).toBeVisible({
    timeout: 15_000,
  });

  const shareCells = await page.locator('table tr td:nth-child(2)').allTextContents();
  const nonZeroBands = shareCells.filter((text) => text.trim() !== '0.0%').length;
  expect(nonZeroBands).toBeGreaterThan(2);
});
