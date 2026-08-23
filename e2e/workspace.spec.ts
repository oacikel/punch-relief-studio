import { expect, test, type Page, type Locator } from '@playwright/test';

/**
 * Scrolls one column's own internal scrollport (not the page) and asserts
 * the OTHER column's `getBoundingClientRect().top` does not move --
 * proving the two columns scroll independently of one another, per the
 * Workspace two-column redesign's explicit requirement that "neither
 * column's content can push the other, or anything in the other, out of
 * view" (see docs/DECISIONS.md).
 */
async function expectIndependentScroll(
  page: Page,
  scrolled: Locator,
  stationary: Locator,
  scrollTop: number,
): Promise<void> {
  const stationaryTopBefore = await stationary.evaluate((el) => el.getBoundingClientRect().top);
  await scrolled.evaluate((el, y) => {
    el.scrollTop = y;
  }, scrollTop);
  await expect.poll(() => scrolled.evaluate((el) => el.scrollTop)).toBeGreaterThan(0); // the column actually has internal scroll room and used it
  const stationaryTopAfter = await stationary.evaluate((el) => el.getBoundingClientRect().top);
  expect(Math.abs(stationaryTopAfter - stationaryTopBefore)).toBeLessThanOrEqual(1);
  await page.waitForTimeout(0); // let any pending layout settle before the next assertion
}

/**
 * Combined-workspace coverage (Iteration 03's #13 change -- see
 * docs/ITERATION_03_PLAN.md and docs/DECISIONS.md). Reworked for the
 * Workspace two-column redesign: a true 50/50 split, both columns capped
 * to the viewport height with independent scroll, and a Pattern /
 * Finished-piece-simulation tab switch on the right instead of two panels
 * stacked one above the other. The former single-sided `position: sticky`
 * mechanism (usability fix #1) no longer applies -- both columns are now
 * plain `overflow-y: auto` boxes inside a fixed-height flex/grid parent
 * (see docs/DECISIONS.md for why `position: sticky` was replaced rather
 * than reused symmetrically), so the tests below assert on that instead.
 */
test.describe('Workspace two-column redesign', () => {
  test('Advanced controls stay collapsed until opened, and both columns are independently, internally scrollable on desktop', async ({
    page,
  }) => {
    // Force a desktop-width viewport regardless of which project runs this
    // (the `mobile-narrow` project's default iPhone 13 viewport is well
    // under the 720px breakpoint where the two-column layout intentionally
    // falls back to single-column stacking -- see the narrow-viewport test
    // below and the `@media (max-width: 720px)` rule in styles.css).
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.getByText('Concentric Ripple').click();
    await page.getByRole('button', { name: 'Continue to Workspace' }).click();
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

    // Both columns are bounded, independently scrollable boxes at desktop
    // width -- the mechanism that replaces the old single-sided sticky
    // preview (see docs/DECISIONS.md for why).
    for (const selector of ['.workspace-controls-col', '.workspace-preview-col']) {
      const overflowY = await page
        .locator(selector)
        .evaluate((el) => getComputedStyle(el).overflowY);
      expect(overflowY).toBe('auto');
    }
  });

  /**
   * Usability fix #1's original concern -- "does adjusting a control lose
   * sight of its effect, or does one column's growth push the other out of
   * view" -- is now addressed structurally (both columns are independently
   * capped/scrollable, not relying on one column happening to be taller
   * than the other), so this is exercised in both the "light" (default
   * settings) and "heavy" (more pile levels, more swatches, an open
   * disclosure) states explicitly, matching the original test's own
   * reasoning that a fix which only works in one state can't pass
   * silently.
   */
  test('scrolling the rail does not move the preview column, and vice versa, in the default/light state', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.getByText('Concentric Ripple').click();
    await page.getByRole('button', { name: 'Continue to Workspace' }).click();
    await expect(page.getByRole('group', { name: 'Pattern view' })).toBeVisible({
      timeout: 15_000,
    });

    const rail = page.locator('.workspace-controls-col');
    const preview = page.locator('.workspace-preview-col');
    await expectIndependentScroll(page, rail, preview, 400);
    await rail.evaluate((el) => {
      el.scrollTop = 0;
    });
    await expectIndependentScroll(page, preview, rail, 100);
  });

  test('scrolling the rail does not move the preview column, and vice versa, in a heavy-use state', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.getByText('Concentric Ripple').click();
    await page.getByRole('button', { name: 'Continue to Workspace' }).click();
    await expect(page.getByRole('group', { name: 'Pattern view' })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByLabel(/Number of pile heights/).fill('12');
    await page.getByText('Advanced shape controls').click();
    await page.getByLabel('Color by height', { exact: false }).check();
    await expect(page.locator('.legend-table tbody tr')).toHaveCount(12, { timeout: 15_000 });

    const rail = page.locator('.workspace-controls-col');
    const preview = page.locator('.workspace-preview-col');
    await expectIndependentScroll(page, rail, preview, 600);
  });

  test('the two-column layout falls back to normal single-column page-scrolled stacking on a narrow viewport', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.getByText('Concentric Ripple').click();
    await page.getByRole('button', { name: 'Continue to Workspace' }).click();
    await expect(page.getByRole('heading', { name: 'Workspace' })).toBeVisible();

    for (const selector of ['.workspace-controls-col', '.workspace-preview-col']) {
      const overflowY = await page
        .locator(selector)
        .evaluate((el) => getComputedStyle(el).overflowY);
      expect(overflowY).toBe('visible');
    }
    // The page itself must be normally scrollable at this width -- the
    // desktop-only `body.workspace-scroll-lock` rule is scoped to
    // `@media (min-width: 721px)` specifically so it doesn't trap this
    // fallback's content (see docs/DECISIONS.md).
    const bodyOverflow = await page.evaluate(() => getComputedStyle(document.body).overflow);
    expect(bodyOverflow).toBe('visible');
  });

  /**
   * Iteration 03 Round 1 (docs/ITERATION_03_PLAN.md #6): needle-setting/
   * calibration UI was removed app-wide by explicit, reversible product
   * decision -- this continues to check that no calibration entry point
   * exists anywhere in the (still single) Workspace page.
   *
   * The former H1/H2/... live coverage-percentage chip row this test used
   * to also check was removed in the Workspace two-column redesign, per
   * explicit product-owner feedback that it "connects to nothing
   * actionable" for a non-technical user (docs/DECISIONS.md) -- there is
   * no replacement readout to assert on here.
   */
  test('Needle & pile has no pile-height coverage chips and no calibration UI anywhere in the app', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByText('Concentric Ripple').click();
    await page.getByRole('button', { name: 'Continue to Workspace' }).click();
    await expect(page.getByRole('group', { name: 'Pattern view' })).toBeVisible({
      timeout: 15_000,
    });

    await expect(page.locator('.level-chip')).toHaveCount(0);
    await expect(page.getByLabel('Pile height coverage')).toHaveCount(0);

    await expect(page.getByRole('columnheader', { name: 'Needle setting' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Calibrate needle settings/ })).toHaveCount(0);
    await expect(page.getByText('not yet calibrated')).toHaveCount(0);

    await page.locator('.export-panel summary').click();
    await expect(page.getByRole('heading', { name: 'Calibration', level: 3 })).toHaveCount(0);
    await expect(page.getByLabel('Profile name')).toHaveCount(0);
  });

  /**
   * The core fix this redesign exists for -- direct product-owner quote:
   * "I don't see that there's a live finished-piece simulation without
   * scrolling down, and I wouldn't have scrolled down if I didn't know it
   * already existed there." The preview column now shows exactly one of
   * Pattern / Finished-piece simulation at a time via a tab switch, never
   * both stacked -- this locks in that the simulation is discoverable (its
   * tab button is visible immediately, no scrolling) and that switching
   * tabs genuinely swaps content rather than revealing a second, already-
   * rendered panel.
   */
  test('the preview column tab-switches between Pattern and Finished-piece simulation, never showing both at once', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByText('Concentric Ripple').click();
    await page.getByRole('button', { name: 'Continue to Workspace' }).click();
    await expect(page.getByRole('group', { name: 'Pattern view' })).toBeVisible({
      timeout: 15_000,
    });

    const patternTab = page.getByRole('button', { name: 'Pattern' });
    const simulationTab = page.getByRole('button', { name: 'Finished-piece simulation' });

    // The simulation tab button is visible without any scrolling, right
    // next to the Pattern tab -- discoverable, not hidden below the fold.
    await expect(simulationTab).toBeVisible();
    await expect(patternTab).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('group', { name: 'Pattern view' })).toBeVisible();
    await expect(page.getByLabel('Finished-piece simulation')).toHaveCount(0);

    await simulationTab.click();
    await expect(simulationTab).toHaveAttribute('aria-pressed', 'true');
    await expect(patternTab).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByLabel('Finished-piece simulation')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Finished-piece simulation' })).toBeVisible();
    // Pattern's own content is genuinely gone, not just visually hidden.
    await expect(page.getByRole('group', { name: 'Pattern view' })).toHaveCount(0);

    await patternTab.click();
    await expect(page.getByRole('group', { name: 'Pattern view' })).toBeVisible();
    await expect(page.getByLabel('Finished-piece simulation')).toHaveCount(0);
  });

  /**
   * Locks in the "true 50/50" requirement explicitly -- both columns are
   * within a few pixels of exactly half the available width at a
   * representative desktop viewport, not the previous asymmetric
   * `minmax(280px, 420px)`-capped preview column.
   */
  test('the two columns split the available width 50/50 on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.getByText('Concentric Ripple').click();
    await page.getByRole('button', { name: 'Continue to Workspace' }).click();
    await expect(page.getByRole('heading', { name: 'Workspace' })).toBeVisible();

    const railWidth = await page
      .locator('.workspace-controls-col')
      .evaluate((el) => el.getBoundingClientRect().width);
    const previewWidth = await page
      .locator('.workspace-preview-col')
      .evaluate((el) => el.getBoundingClientRect().width);
    expect(Math.abs(railWidth - previewWidth)).toBeLessThanOrEqual(2);
  });

  /**
   * Usability fix #3 (docs/DECISIONS.md): sticky mini-headers so scrolling
   * two sections deep into the rail still shows which section you're in.
   * Scoped to `.rail-section` only -- the nested "Color story palettes"
   * sub-group inside Yarn colors deliberately does NOT get this
   * treatment, so its own heading never competes with the outer "Yarn
   * colors" heading for the same stuck position. Kept through the
   * Workspace two-column redesign (the rail jump-nav that originally
   * shipped alongside this was removed per explicit product-owner
   * feedback -- "nice thought, but unnecessary" -- but this smaller
   * wayfinding aid was not objected to). Now scrolls the rail's OWN
   * internal scrollport (`.workspace-controls-col`, `overflow-y: auto`)
   * rather than the page, since the rail is no longer part of normal
   * document flow at desktop width.
   */
  test('rail section headings stick to the top while scrolled within their own section', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.getByText('Concentric Ripple').click();
    await page.getByRole('button', { name: 'Continue to Workspace' }).click();
    await expect(page.getByRole('group', { name: 'Pattern view' })).toBeVisible({
      timeout: 15_000,
    });

    const rail = page.locator('.workspace-controls-col');
    const needleSection = page.locator('#rail-needle-pile');
    const needleHeading = page.locator('#rail-needle-pile > h3');
    const needleTopUnscrolled = await needleHeading.evaluate(
      (el) => el.getBoundingClientRect().top,
    );
    expect(needleTopUnscrolled).toBeGreaterThan(0); // not stuck yet, unscrolled

    // Position: sticky only holds within its own containing block's own
    // bounds -- past that (once the whole "Needle & pile" section has
    // scrolled out of view), the heading correctly releases and scrolls
    // away with it, which is expected CSS behavior, not a bug. Compute the
    // section's own offset and height within the rail's scrollport (at
    // scrollTop 0) so the two scroll positions tested are both safely
    // inside it, rather than guessing.
    const [railTop, sectionTop, sectionHeight] = await Promise.all([
      rail.evaluate((el) => el.getBoundingClientRect().top),
      needleSection.evaluate((el) => el.getBoundingClientRect().top),
      needleSection.evaluate((el) => el.getBoundingClientRect().height),
    ]);
    const sectionOffsetInRail = sectionTop - railTop;
    const firstScroll = Math.round(sectionOffsetInRail + sectionHeight * 0.25);
    const secondScroll = Math.round(sectionOffsetInRail + sectionHeight * 0.5);

    await rail.evaluate((el, y) => {
      el.scrollTop = y;
    }, firstScroll);
    const topAtFirst = await needleHeading.evaluate((el) => el.getBoundingClientRect().top);
    expect(topAtFirst).toBeLessThan(needleTopUnscrolled); // did move once scrolled

    await rail.evaluate((el, y) => {
      el.scrollTop = y;
    }, secondScroll);
    // Once stuck, the heading's own top stops moving even as the rail
    // keeps scrolling further (while still within its own section) -- a
    // more robust invariant than computing one expected pixel value (which
    // depends on the exact padding/margin chain between the rail's own box
    // and the sticky `<h3>`, not just its scroll container).
    await expect
      .poll(() => needleHeading.evaluate((el) => el.getBoundingClientRect().top))
      .toBe(topAtFirst);

    // The nested "Color story palettes" group never gets the sticky
    // treatment -- switch to color-by-height mode to reveal it, and
    // confirm it's plain `position: static`.
    await page.getByLabel('Color by height', { exact: false }).check();
    const nestedHeading = page.getByText('Color story palettes');
    await expect(nestedHeading).toBeVisible();
    await expect(nestedHeading).toHaveCSS('position', 'static');
  });

  /**
   * The ambient "current model" top bar (replacing the former StageNav
   * sidebar, see docs/DECISIONS.md) -- its "Change" action navigates back
   * to Import, framed as ambient state with a direct action rather than a
   * wizard "back" step. This confirms the button actually works, and that
   * the previously-loaded model is still there (not cleared), matching
   * the existing "swap models" collapsed-picker behavior already covered
   * in e2e/orient-persistence.spec.ts.
   */
  test('the model bar shows the loaded model name, and "Change" navigates back to Import', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByText('Concentric Ripple').click();
    await page.getByRole('button', { name: 'Continue to Workspace' }).click();
    await expect(page.getByRole('heading', { name: 'Workspace' })).toBeVisible();

    await expect(page.getByText('Model:')).toBeVisible();
    await expect(page.getByText('Concentric Ripple', { exact: false })).toBeVisible();
    const changeButton = page.getByRole('button', { name: 'Change' });
    await expect(changeButton).toBeVisible();

    await changeButton.click();
    await expect(page.getByRole('heading', { name: 'Import a model' })).toBeVisible();
    // Not framed as a step "back" -- ambient state persists: the model is
    // still loaded, and the picker shows it rather than resetting.
    await expect(page.getByText(/Model loaded: Concentric Ripple/)).toBeVisible();
    // The model bar itself only makes sense on Workspace -- Import is
    // already where "Change" would take you.
    await expect(page.getByText('Model:')).toHaveCount(0);
  });
});
