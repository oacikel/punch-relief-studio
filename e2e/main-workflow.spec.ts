import { expect, test } from '@playwright/test';

/**
 * End-to-end scenario covering the main workflow: load the ripple sample,
 * change height levels, assign colors, inspect the simulation, set physical
 * dimensions, export, save/reload project settings, and confirm
 * consistency.
 *
 * Updated for Iteration 02 Stage A: 5 visible stages instead of 7 (no
 * separate "Orient"/"Export" stage -- see docs/ITERATION_02_PLAN.md).
 * Orientation now shows on "Import" once a model has loaded; export/print/
 * project-JSON actions now live in a collapsed "Export & print" panel on
 * "Preview", opened here via its <summary> before interacting with the
 * controls inside it.
 */
test.describe('main workflow', () => {
  test('ripple sample end-to-end', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Punch Relief Studio' })).toBeVisible();

    // 1-2: load the ripple sample; Import now also shows the orientation
    // section once a model has loaded.
    await page.getByText('Concentric Ripple').click();
    await expect(page.getByRole('heading', { name: 'Orient the model' })).toBeVisible();

    // Move to relief stage
    await page.getByRole('button', { name: '2. Create relief' }).click();
    await expect(page.getByRole('heading', { name: 'Create the relief' })).toBeVisible();

    // 3: change from default (4) to 5 height levels (relabeled "Number of
    // pile heights" in Iteration 02 Stage B -- see docs/ITERATION_02_PLAN.md §5)
    const levelsSlider = page.getByLabel(/Number of pile heights/);
    await levelsSlider.fill('5');
    await expect(page.getByLabel(/Number of pile heights \(5\)/)).toBeVisible();

    await page.getByRole('button', { name: 'Generate relief' }).click();
    await expect(page.getByRole('heading', { name: 'Height levels' })).toBeVisible({
      timeout: 15_000,
    });

    // 4: assign colors
    await page.getByRole('button', { name: '4. Yarn colors' }).click();
    await page.getByLabel('Color by height').check();

    // 5: inspect the finished-project simulation
    await page.getByRole('button', { name: '5. Preview' }).click();
    await expect(page.getByLabel('Finished-piece simulation')).toBeVisible();
    await expect(page.getByText('Simulation -- not a photo')).toBeVisible();

    // 6: open the compact export panel and set physical dimensions
    await page.getByText('Export & print').click();
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
