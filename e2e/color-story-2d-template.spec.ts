import { expect, test } from '@playwright/test';

/**
 * EXP-006 ("Apply color scheme options to 2d templates"): the bundled
 * "color story" palette gallery (already available to 3D-model color-by-
 * height swatches, see palette-picker.spec.ts) is now also offered for a
 * 2D template's (image import's) "Simplified image palette" swatches, and
 * survives the image being re-simplified after a settings change instead
 * of reverting to the auto-detected colors.
 */
test('applying a color story to a 2D template recolors its swatches and survives re-simplification', async ({
  page,
}) => {
  await page.goto('/');

  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 80;
    canvas.height = 60;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable');
    context.fillStyle = '#e9c96a';
    context.fillRect(0, 0, 80, 60);
    context.fillStyle = '#264f53';
    context.beginPath();
    context.arc(40, 30, 20, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#d45a45';
    context.fillRect(35, 12, 10, 36);
    return canvas.toDataURL('image/png');
  });
  const png = Buffer.from(dataUrl.split(',')[1] ?? '', 'base64');

  await page.getByLabel('Choose a 2D image or 3D model to import').setInputFiles({
    name: 'sample-art.png',
    mimeType: 'image/png',
    buffer: png,
  });

  await expect(page.getByRole('heading', { name: 'Simplify the image' })).toBeVisible();
  await page.getByRole('button', { name: /^2 Yarn$/ }).click();
  await expect(page.getByLabel(/Simplified image palette/)).toBeChecked();

  const firstSwatchColor = page.locator('#swatch-color-0');
  const before = await firstSwatchColor.inputValue();

  await expect(page.getByText('Color story palettes')).toBeVisible();
  await page.getByRole('button', { name: /Terrain/ }).click();
  const afterPalette = await firstSwatchColor.inputValue();
  expect(afterPalette).not.toBe(before);

  // Trigger a re-simplification (any relief-setting change re-runs the
  // image pipeline and recomputes the auto-detected palette from scratch).
  await page.getByRole('button', { name: /^1 Shape$/ }).click();
  await page.locator('#image-smoothing').evaluate((el: HTMLInputElement) => {
    el.value = '0.5';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.getByRole('button', { name: /^2 Yarn$/ }).click();

  // The chosen color story survives the regeneration instead of reverting
  // to the auto-detected image colors.
  await expect(firstSwatchColor).toHaveValue(afterPalette);
});
