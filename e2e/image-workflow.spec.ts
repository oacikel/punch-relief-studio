import { expect, test } from '@playwright/test';

test('imports a flat image and opens the smart-zone workflow', async ({ page }) => {
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

  await page.getByLabel('Choose image to import').setInputFiles({
    name: 'sample-art.png',
    mimeType: 'image/png',
    buffer: png,
  });

  await expect(page.getByText('Source:').locator('..')).toContainText('sample-art.png');
  await expect(page.getByRole('heading', { name: 'Simplify the image' })).toBeVisible();
  await expect(page.getByText('Smart zones, not pixels')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your pattern' })).toBeVisible();
  await page.getByRole('button', { name: 'Source image' }).click();
  await expect(page.getByAltText('Original imported source')).toBeVisible();
  await page.getByRole('button', { name: 'Pattern' }).click();

  await page.getByRole('button', { name: /^2 Yarn$/ }).click();
  await expect(page.getByLabel(/Simplified image palette/)).toBeChecked();
  await expect(page.getByLabel(/Palette size/)).toBeVisible();
  await expect(page.getByRole('row', { name: /C1/ })).toBeVisible();
});
