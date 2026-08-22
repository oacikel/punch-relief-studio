import { expect, test } from '@playwright/test';

/**
 * Iteration 03 Round 1 (docs/ITERATION_03_PLAN.md #7): a small, bundled
 * "color story" palette gallery on the Yarn Colors stage, applicable to
 * color-by-height swatches in one click, with individual swatches still
 * hand-editable afterward.
 */
test.describe('Color story palettes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByText('Concentric Ripple').click();
    await page.getByRole('button', { name: '2. Create relief' }).click();
    await page.getByRole('button', { name: 'Generate relief' }).click();
    await expect(page.getByRole('heading', { name: 'Height levels' })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('button', { name: '4. Yarn colors' }).click();
    await page.getByLabel('Color by height').check();
  });

  test('is hidden in "single" mode and shown in "by-height" mode', async ({ page }) => {
    await page.getByLabel('Single yarn', { exact: false }).check();
    await expect(page.getByText('Color story palettes')).toBeHidden();

    await page.getByLabel('Color by height', { exact: false }).check();
    await expect(page.getByText('Color story palettes')).toBeVisible();
  });

  test('applying a palette changes the swatch colors, which stay hand-editable afterward', async ({
    page,
  }) => {
    const firstSwatchColor = page.locator('#swatch-color-0');
    const before = await firstSwatchColor.inputValue();

    await page.getByRole('button', { name: /Terrain/ }).click();
    const afterPalette = await firstSwatchColor.inputValue();
    expect(afterPalette).not.toBe(before);

    // Hand-edit the first swatch after applying the palette -- it should
    // hold the manual edit, not get reverted.
    await firstSwatchColor.fill('#123456');
    await expect(firstSwatchColor).toHaveValue('#123456');
  });
});
