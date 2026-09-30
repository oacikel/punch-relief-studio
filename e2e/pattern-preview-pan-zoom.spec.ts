import { expect, test } from '@playwright/test';

/**
 * EXP-007 ("ship fit-to-screen default plus pan and zoom as a standalone
 * release" -- see docs/ANALYTICS.md/DECISIONS.md). Unit tests cover the
 * zoom/pan arithmetic directly (`patternPreviewGestures.test.ts`) and what
 * jsdom can exercise of the component itself (`PatternPreview.test.tsx`,
 * wheel-driven zoom only -- jsdom has no `PointerEvent`). This spec is the
 * only coverage of the actual pointer-driven pan gesture, in a real
 * browser.
 */
test.describe('Pattern preview pan/zoom (EXP-007)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByText('Concentric Ripple').click();
    await page.getByRole('button', { name: /Create my pattern/ }).click();
    await expect(page.getByRole('group', { name: 'Pattern view' })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('opens fit-to-screen, with a visible, initially-disabled Fit control', async ({ page }) => {
    await expect(page.getByAltText(/Punch-needle pattern/)).toBeVisible({ timeout: 15_000 });
    const fitButton = page.getByRole('button', { name: 'Fit to screen' });
    await expect(fitButton).toBeVisible();
    await expect(fitButton).toBeDisabled();
    await expect(page.getByText('100% zoom')).toBeVisible();
  });

  test('scrolling over the preview zooms in/out, and Fit to screen resets it', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile === true, 'Playwright mobile WebKit does not support mouse-wheel input');
    const image = page.getByAltText(/Punch-needle pattern/);
    await expect(image).toBeVisible({ timeout: 15_000 });
    const box = await image.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

    await page.mouse.wheel(0, -500); // scroll "up" zooms in
    const fitButton = page.getByRole('button', { name: 'Fit to screen' });
    await expect(fitButton).toBeEnabled();
    await expect(page.getByText('100% zoom')).not.toBeVisible();

    await fitButton.click();
    await expect(page.getByText('100% zoom')).toBeVisible();
    await expect(fitButton).toBeDisabled();
  });

  test('dragging while zoomed in pans the pattern', async ({ page, isMobile }) => {
    test.skip(isMobile === true, 'This setup uses mouse-wheel input before testing pointer drag');
    const image = page.getByAltText(/Punch-needle pattern/);
    await expect(image).toBeVisible({ timeout: 15_000 });
    const box = await image.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    // Zoom in first -- at the fit default there is nowhere to pan to (the
    // whole pattern is already on screen), by design.
    await page.mouse.move(centerX, centerY);
    await page.mouse.wheel(0, -800);
    await expect(page.getByRole('button', { name: 'Fit to screen' })).toBeEnabled();

    const beforeTransform = await image.evaluate((el) => (el as HTMLElement).style.transform);

    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX + 60, centerY + 40, { steps: 8 });
    await page.mouse.up();

    const afterTransform = await image.evaluate((el) => (el as HTMLElement).style.transform);
    expect(afterTransform).not.toBe(beforeTransform);
  });
});
