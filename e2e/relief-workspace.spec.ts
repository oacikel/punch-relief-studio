import { expect, test } from '@playwright/test';

/**
 * Iteration 02 Stage B coverage: Relief-stage terminology/grouping, the
 * sticky preview layout, and the Height Levels -> Preview contextual
 * calibration link. See docs/ITERATION_02_PLAN.md §5/§8/§14.
 */
test.describe('Relief workspace (Iteration 02 Stage B)', () => {
  test('Advanced controls stay collapsed until opened, and the sticky preview column pins on desktop', async ({
    page,
  }) => {
    // Force a desktop-width viewport regardless of which project runs this
    // (the `mobile-narrow` project's default iPhone 13 viewport is well
    // under the 720px breakpoint where sticky intentionally falls back to
    // static stacking -- see the companion "narrow viewport" test below and
    // the `@media (max-width: 720px)` rule in styles.css).
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.getByText('Concentric Ripple').click();
    await page.getByRole('button', { name: '2. Create relief' }).click();
    await expect(page.getByRole('heading', { name: 'Create the relief' })).toBeVisible();

    // Basic controls visible immediately.
    await expect(page.getByLabel(/Number of pile heights/)).toBeVisible();
    await expect(page.getByLabel('Relief depth')).toBeVisible();
    await expect(page.getByLabel('Smoothing')).toBeVisible();
    await expect(page.getByLabel('Smallest punchable region')).toBeVisible();

    // Advanced controls are collapsed by default (product owner's own
    // "Advanced shape controls" label from item 7, per §5's table).
    await expect(page.getByLabel('Height band spacing')).toBeHidden();
    await page.getByText('Advanced shape controls').click();
    await expect(page.getByLabel('Height band spacing')).toBeVisible();

    // "Detail resolution" was removed entirely in Iteration 03 Round 1
    // (docs/ITERATION_03_PLAN.md #2) -- no longer a control anywhere, not
    // even under Advanced.
    await expect(page.getByLabel('Detail resolution')).toHaveCount(0);
    await expect(page.getByText('Advanced punch detail controls')).toHaveCount(0);

    // Sticky preview: the shared viewport panel is pinned via CSS
    // `position: sticky` at desktop width (see the `.relief-preview-col`
    // rule in styles.css and the interpretation note in docs/DECISIONS.md).
    const previewPosition = await page
      .locator('.relief-preview-col')
      .evaluate((el) => getComputedStyle(el).position);
    expect(previewPosition).toBe('sticky');
  });

  test('sticky preview falls back to normal stacking on a narrow viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.getByText('Concentric Ripple').click();
    await page.getByRole('button', { name: '2. Create relief' }).click();
    await expect(page.getByRole('heading', { name: 'Create the relief' })).toBeVisible();

    const previewPosition = await page
      .locator('.relief-preview-col')
      .evaluate((el) => getComputedStyle(el).position);
    expect(previewPosition).toBe('static');
  });

  test('"Calibrate needle settings" on Height Levels jumps to Preview with calibration open', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByText('Concentric Ripple').click();
    await page.getByRole('button', { name: '2. Create relief' }).click();
    await page.getByRole('button', { name: 'Generate relief' }).click();
    await expect(page.getByRole('heading', { name: 'Height levels' })).toBeVisible({
      timeout: 15_000,
    });

    await expect(page.getByText('not yet calibrated (relative order only)')).toBeVisible();
    await page.getByRole('button', { name: /Calibrate needle settings/ }).click();

    await expect(page.getByRole('heading', { name: 'Preview the finished piece' })).toBeVisible();
    // The Export & print disclosure should already be open, with the
    // Calibration section (inside it) visible without clicking anything.
    await expect(page.getByRole('heading', { name: 'Calibration', level: 3 })).toBeVisible();
    await expect(page.getByLabel('Profile name')).toBeVisible();
  });
});
