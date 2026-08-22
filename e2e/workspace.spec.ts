import { expect, test } from '@playwright/test';

/**
 * Combined-workspace coverage (Iteration 03's #13 change -- see
 * docs/ITERATION_03_PLAN.md and docs/DECISIONS.md). Renamed from the
 * former `relief-workspace.spec.ts` (Iteration 02 Stage B's Relief-stage
 * terminology/grouping and sticky-preview tests), since "Relief" is no
 * longer a separate stage -- everything that spec covered now lives on
 * the single "Workspace" stage, whose sticky preview column mechanism is
 * reused verbatim (renamed from `.relief-preview-col` to
 * `.workspace-preview-col`, see docs/DECISIONS.md).
 */
test.describe('Combined Workspace', () => {
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
    await page.getByRole('button', { name: '2. Workspace' }).click();
    await expect(page.getByRole('heading', { name: 'Workspace' })).toBeVisible();

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

    // No manual "Generate relief" button anymore -- live regeneration
    // replaces it entirely.
    await expect(page.getByRole('button', { name: 'Generate relief' })).toHaveCount(0);

    // Sticky preview: the preview column is pinned via CSS `position:
    // sticky` at desktop width (see the `.workspace-preview-col` rule in
    // styles.css and the interpretation note in docs/DECISIONS.md).
    const previewPosition = await page
      .locator('.workspace-preview-col')
      .evaluate((el) => getComputedStyle(el).position);
    expect(previewPosition).toBe('sticky');
  });

  test('sticky preview falls back to normal stacking on a narrow viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.getByText('Concentric Ripple').click();
    await page.getByRole('button', { name: '2. Workspace' }).click();
    await expect(page.getByRole('heading', { name: 'Workspace' })).toBeVisible();

    const previewPosition = await page
      .locator('.workspace-preview-col')
      .evaluate((el) => getComputedStyle(el).position);
    expect(previewPosition).toBe('static');
  });

  /**
   * Iteration 03 Round 1 (docs/ITERATION_03_PLAN.md #6): needle-setting/
   * calibration UI was removed app-wide by explicit, reversible product
   * decision. As of the combined-workspace change, the former per-level
   * "Level"/"Share of pattern" table (HeightStage.tsx) no longer exists --
   * it's a live chip readout under "Needle & pile" now (see
   * docs/DECISIONS.md) -- so this replaces the old columnheader-based
   * assertions with chip-based ones, and continues to check that no
   * calibration entry point exists anywhere in the (now single) Workspace
   * page.
   */
  test('Needle & pile shows plain live coverage chips, with no calibration UI anywhere in the app', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByText('Concentric Ripple').click();
    await page.getByRole('button', { name: '2. Workspace' }).click();
    await expect(page.locator('.level-chip').first()).toBeVisible({ timeout: 15_000 });

    const chips = await page.locator('.level-chip').allTextContents();
    expect(chips.length).toBeGreaterThan(0);
    for (const chip of chips) expect(chip).toMatch(/^H\d+ \d+\.\d%$/);

    await expect(page.getByRole('columnheader', { name: 'Needle setting' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Calibrate needle settings/ })).toHaveCount(0);
    await expect(page.getByText('not yet calibrated')).toHaveCount(0);

    await page.getByText('Export & print', { exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Calibration', level: 3 })).toHaveCount(0);
    await expect(page.getByLabel('Profile name')).toHaveCount(0);
  });

  /**
   * New coverage for the combined-workspace change: both the Pattern
   * panel and the Finished-piece simulation panel are visible at once, in
   * the same sticky column, with no tab-switching required.
   */
  test('the Pattern panel and Finished-piece simulation panel are both visible at once', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByText('Concentric Ripple').click();
    await page.getByRole('button', { name: '2. Workspace' }).click();
    await expect(page.locator('.level-chip').first()).toBeVisible({ timeout: 15_000 });

    await expect(page.getByRole('heading', { name: 'Pattern' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Pattern view' })).toBeVisible();
    await expect(page.getByLabel('Finished-piece simulation')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Finished-piece simulation' })).toBeVisible();
  });
});
