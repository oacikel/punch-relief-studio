import { expect, test } from '@playwright/test';

/**
 * End-to-end scenario covering the main workflow: load the ripple sample,
 * change height levels, assign colors, inspect the simulation, set physical
 * dimensions, export, save/reload project settings, and confirm
 * consistency.
 *
 * Updated for Iteration 03's combined-workspace change
 * (docs/ITERATION_03_PLAN.md #13): the former 5 stages (Import, Create
 * relief, Height levels, Yarn colors, Preview) collapse to 2 (Import,
 * Workspace). Everything that used to require navigating between separate
 * stages -- adjusting pile heights, picking a color mode, inspecting the
 * simulation, opening Export & print -- now happens on the one Workspace
 * page, and relief generation is live/debounced rather than a manual
 * button click.
 */
test.describe('main workflow', () => {
  test('ripple sample end-to-end', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Punch Relief Studio' })).toBeVisible();

    // 1-2: load the ripple sample; Import shows the orientation section
    // once a model has loaded.
    await page.getByText('Concentric Ripple').click();
    await expect(page.getByRole('heading', { name: 'Orient the model' })).toBeVisible();

    // Move to the combined Workspace.
    await page.getByRole('button', { name: '2. Workspace' }).click();
    await expect(page.getByRole('heading', { name: 'Workspace' })).toBeVisible();

    // 3: change from default (4) to 5 height levels (relabeled "Number of
    // pile heights" in Iteration 02 Stage B -- see docs/ITERATION_02_PLAN.md §5)
    const levelsSlider = page.getByLabel(/Number of pile heights/);
    await levelsSlider.fill('5');
    await expect(page.getByLabel(/Number of pile heights \(5\)/)).toBeVisible();

    // No manual "Generate relief" button anymore -- wait for the live
    // regeneration to land (5 coverage chips, matching the new level count).
    await expect(page.locator('.level-chip')).toHaveCount(5, { timeout: 15_000 });

    // 4: assign colors -- already visible in the rail, no navigation needed.
    await page.getByLabel('Color by height').check();

    // 5: inspect the finished-piece simulation -- already visible in the
    // sticky preview column, no navigation needed.
    await expect(page.getByLabel('Finished-piece simulation')).toBeVisible();
    await expect(page.getByText('Simulation -- not a photo')).toBeVisible();

    // 6: open the compact export panel and set physical dimensions
    await page.locator('.export-panel summary').click();
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
