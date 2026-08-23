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
 *
 * Updated again for the Workspace two-column redesign (see
 * docs/DECISIONS.md): the former H1/H2/... coverage-percentage chip row
 * was removed, so step 3 below now confirms the new level count via the
 * "Color by height" swatch table instead (kept in exact 1:1 sync with the
 * generated level count by `resizeSwatches`/`PROCESSING_SUCCEEDED`, see
 * src/state/appState.ts) -- switching color mode earlier than the original
 * test did, specifically to get that readout. Step 5 now clicks the
 * "Finished-piece simulation" tab before asserting its content is visible,
 * since Pattern and Finished-piece simulation are no longer both visible
 * at once -- the whole point of the redesign.
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
    await page.getByRole('button', { name: 'Continue to Workspace' }).click();
    await expect(page.getByRole('heading', { name: 'Workspace' })).toBeVisible();

    // 3: change from default (4) to 5 height levels (relabeled "Number of
    // pile heights" in Iteration 02 Stage B -- see docs/ITERATION_02_PLAN.md §5)
    const levelsSlider = page.getByLabel(/Number of pile heights/);
    await levelsSlider.fill('5');
    await expect(page.getByLabel(/Number of pile heights \(5\)/)).toBeVisible();

    // 4: assign colors -- already visible in the rail, no navigation needed.
    // Switching to "Color by height" here (rather than after, as this test
    // originally did) doubles as the wait for live regeneration to land:
    // by-height swatches are kept in exact 1:1 sync with the generated
    // level count (src/state/appState.ts's resizeSwatches), so 5 swatch
    // rows only appear once the 5-level relief has actually finished
    // generating.
    await page.getByLabel('Color by height').check();
    await expect(page.locator('.legend-table tbody tr')).toHaveCount(5, { timeout: 15_000 });

    // 5: inspect the finished-piece simulation -- a click away via the
    // preview column's tab switch, not stacked below the Pattern panel.
    await page.getByRole('button', { name: 'Finished-piece simulation' }).click();
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
