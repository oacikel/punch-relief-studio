import { expect, test } from '@playwright/test';

/**
 * End-to-end scenario covering the main workflow described in the product
 * spec: load the ripple sample, change height levels, assign colors,
 * inspect the simulation, set physical dimensions, export, save/reload
 * project settings, and confirm consistency.
 *
 * NOT YET RUN in this session -- this sandbox has no network access to
 * install Playwright browsers (see docs/TEST_REPORT.md). Run with:
 *   npx playwright install --with-deps chromium && npm run test:e2e
 */
test.describe('main workflow', () => {
  test('ripple sample end-to-end', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Punch Relief Studio' })).toBeVisible();

    // 1-2: load the ripple sample
    await page.getByText('Concentric Ripple').click();
    await expect(page.getByRole('heading', { name: 'Orient the model' })).toBeVisible();

    // Move to relief stage
    await page.getByRole('button', { name: '3. Create relief' }).click();
    await expect(page.getByRole('heading', { name: 'Create the relief' })).toBeVisible();

    // 3: change from default (4) to 5 height levels
    const levelsSlider = page.getByLabel(/Height levels/);
    await levelsSlider.fill('5');
    await expect(page.getByLabel(/Height levels \(5\)/)).toBeVisible();

    await page.getByRole('button', { name: 'Generate relief' }).click();
    await expect(page.getByRole('heading', { name: 'Height levels' })).toBeVisible({ timeout: 15_000 });

    // 4: assign colors
    await page.getByRole('button', { name: '5. Yarn colors' }).click();
    await page.getByLabel('Color by height').check();

    // 5: inspect the finished-project simulation
    await page.getByRole('button', { name: '6. Preview' }).click();
    await expect(page.getByLabel('Finished-piece simulation')).toBeVisible();
    await expect(page.getByText('Simulation -- not a photo')).toBeVisible();

    // 6: set physical dimensions
    await page.getByRole('button', { name: '7. Export' }).click();
    await page.getByLabel('Width (cm)').fill('30');
    await expect(page.getByLabel('Width (cm)')).toHaveValue('30');

    // 7: generate a printable export
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export SVG pattern' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.svg$/);

    // 8: save project settings
    const projectDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save project settings (JSON)' }).click();
    const projectDownload = await projectDownloadPromise;
    expect(projectDownload.suggestedFilename()).toMatch(/\.json$/);

    // 9-10: reload the app and confirm it comes back to a consistent, usable state
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Import a model' })).toBeVisible();
  });
});
