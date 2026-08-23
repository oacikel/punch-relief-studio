import { expect, test, type Page } from '@playwright/test';

/**
 * Usability fix #1 (docs/DECISIONS.md): scrolls the page by the given
 * amounts and asserts `.workspace-preview-col`'s `getBoundingClientRect()
 * .top` stays within a small tolerance of its pinned position at each
 * one. Checking `getComputedStyle(...).position === 'sticky'` alone (the
 * old version of this test) only proves the CSS declaration exists -- it
 * does not prove the element actually stays visually pinned during a real
 * scroll, which is exactly how the underlying bug shipped undetected (the
 * column had zero slack to pin within in the default/light state, so it
 * scrolled in lockstep with the page despite `position: sticky` being
 * correctly declared the whole time).
 */
async function expectPreviewStaysPinned(page: Page, scrollYPositions: number[]): Promise<void> {
  const preview = page.locator('.workspace-preview-col');
  const pinnedTop = await preview.evaluate((el) => parseFloat(getComputedStyle(el).top));
  for (const y of scrollYPositions) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    const top = await preview.evaluate((el) => el.getBoundingClientRect().top);
    expect(Math.abs(top - pinnedTop)).toBeLessThanOrEqual(2);
  }
}

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

  /**
   * Usability fix #1 (docs/DECISIONS.md): the "light" state -- default
   * settings, nothing expanded -- is exactly the state the original bug
   * shipped in (the preview column was naturally *taller* than the rail
   * here, leaving `position: sticky` no slack to pin within, so it just
   * scrolled in lockstep with the page despite the CSS declaring
   * `sticky`). This is why a real-scroll assertion is required, not just
   * `getComputedStyle(...).position === 'sticky'` (which was true the
   * whole time the bug shipped).
   */
  test('sticky preview column stays visually pinned while scrolling in the default/light state', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.getByText('Concentric Ripple').click();
    await page.getByRole('button', { name: '2. Workspace' }).click();
    await expect(page.locator('.level-chip').first()).toBeVisible({ timeout: 15_000 });

    await expectPreviewStaysPinned(page, [300, 600]);
  });

  /**
   * Usability fix #1 (docs/DECISIONS.md): the "heavy" state -- more pile
   * levels, an Advanced disclosure open, more color swatches -- is the
   * state the original bug's sticky mechanism happened to already work
   * in, by accident (the rail grows past the preview column's natural
   * height). Covered explicitly alongside the light-state test above so a
   * fix that only works in one state can't pass silently.
   */
  test('sticky preview column stays visually pinned while scrolling in a heavy-use state', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.getByText('Concentric Ripple').click();
    await page.getByRole('button', { name: '2. Workspace' }).click();
    await expect(page.locator('.level-chip').first()).toBeVisible({ timeout: 15_000 });

    await page.getByLabel(/Number of pile heights/).fill('12');
    await page.getByText('Advanced shape controls').click();
    await page.getByLabel('Color by height', { exact: false }).check();
    await expect(page.locator('.level-chip')).toHaveCount(12, { timeout: 15_000 });

    await expectPreviewStaysPinned(page, [300, 900]);
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

    await page.locator('.export-panel summary').click();
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

  /**
   * Usability fixes #3/#4 (docs/DECISIONS.md): a short jump-nav near the
   * Workspace heading, one button per rail section, so a section further
   * down a long rail is never more than one click away -- and, for
   * "Export & print" specifically, this is also the persistent affordance
   * for a disclosure that's otherwise the last, easy-to-forget thing in
   * the rail after every color swatch.
   */
  test('the jump-nav scrolls to each rail section, and opens Export & print', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.getByText('Concentric Ripple').click();
    await page.getByRole('button', { name: '2. Workspace' }).click();
    await expect(page.locator('.level-chip').first()).toBeVisible({ timeout: 15_000 });

    const nav = page.getByRole('navigation', { name: 'Jump to rail section' });
    await expect(nav.getByRole('button', { name: 'Needle & pile' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Punch detail' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Shape interpretation' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Yarn colors' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Export & print' })).toBeVisible();

    // Scroll away from the top first so a "jump" is meaningful, then
    // confirm the Shape interpretation section's own heading actually
    // lands near the viewport top.
    await page.evaluate(() => window.scrollTo(0, 0));
    await nav.getByRole('button', { name: 'Shape interpretation' }).click();
    await expect(page.locator('#rail-shape-interpretation h3')).toBeVisible();
    await expect
      .poll(() =>
        page
          .locator('#rail-shape-interpretation h3')
          .evaluate((el) => el.getBoundingClientRect().top),
      )
      .toBeLessThan(50);

    // Export & print is collapsed by default -- the jump-nav both scrolls
    // to it and opens the disclosure, in one click.
    await expect(page.locator('.export-panel[open]')).toHaveCount(0);
    await nav.getByRole('button', { name: 'Export & print' }).click();
    await expect(page.locator('.export-panel[open]')).toBeVisible();
    await expect(page.locator('#rail-export-print')).toBeInViewport();
  });

  /**
   * Usability fix #3 (docs/DECISIONS.md): sticky mini-headers so scrolling
   * two sections deep into the rail still shows which section you're in.
   * Scoped to `.rail-section` only -- the nested "Color story palettes"
   * sub-group inside Yarn colors deliberately does NOT get this
   * treatment, so its own heading never competes with the outer "Yarn
   * colors" heading for the same stuck position.
   */
  test('rail section headings stick to the top while scrolled within their own section', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.getByText('Concentric Ripple').click();
    await page.getByRole('button', { name: '2. Workspace' }).click();
    await expect(page.locator('.level-chip').first()).toBeVisible({ timeout: 15_000 });

    const needleHeading = page.locator('#rail-needle-pile > h3');
    const needleTopUnscrolled = await needleHeading.evaluate(
      (el) => el.getBoundingClientRect().top,
    );
    expect(needleTopUnscrolled).toBeGreaterThan(0); // not stuck yet at scrollY 0

    await page.evaluate(() => window.scrollTo(0, 300));
    await expect.poll(() => needleHeading.evaluate((el) => el.getBoundingClientRect().top)).toBe(0);

    // The nested "Color story palettes" group never gets the sticky
    // treatment -- switch to color-by-height mode to reveal it, and
    // confirm it's plain `position: static`.
    await page.getByLabel('Color by height', { exact: false }).check();
    const nestedHeading = page.getByText('Color story palettes');
    await expect(nestedHeading).toBeVisible();
    await expect(nestedHeading).toHaveCSS('position', 'static');
  });
});
