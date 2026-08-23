import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Iteration 03 Round 2 #5: automated accessibility sweep across the app's
 * main stages, using axe-core. docs/LIMITATIONS.md previously recorded
 * that no automated axe-core run had ever been executed -- originally
 * because no browser was available in the sandbox that built this MVP, not
 * because of a product decision. This closes that gap for real: each test
 * below fails on any actual violation axe-core finds (not a smoke test that
 * always passes), scoped to the WCAG 2.0/2.1 A and AA rule sets plus
 * axe-core's general best-practice rules.
 *
 * Updated for Iteration 03's combined-workspace change
 * (docs/ITERATION_03_PLAN.md #13): the former 5 stages (Import, Create
 * relief, Height levels, Yarn colors, Preview) collapse to 2 (Import,
 * Workspace) -- the per-stage sweeps below now cover Import (before/after
 * a model loads) and the single Workspace stage (both before and after the
 * first live relief has generated, and with the Export & print panel
 * opened), rather than one sweep per former wizard page. This keeps the
 * same number of meaningful checkpoints without inventing new ones.
 *
 * Runs against both the `chromium` and `mobile-narrow` (WebKit) Playwright
 * projects, same as every other e2e spec in this repo.
 */
async function expectNoViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
    .analyze();
  // On failure, print what axe actually found (rule id + affected nodes) so
  // a real violation is diagnosable straight from CI output, not just a
  // bare "expected 0" assertion failure.
  expect(
    results.violations,
    JSON.stringify(
      results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.map((n) => n.target),
      })),
      null,
      2,
    ),
  ).toEqual([]);
}

test.describe('Accessibility sweep (Iteration 03 Round 2 #5)', () => {
  test('Import stage (before a model is loaded)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Import a model' })).toBeVisible();
    await expectNoViolations(page);
  });

  test('Import stage (with a model loaded, orientation section visible)', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Concentric Ripple').click();
    await expect(page.getByRole('heading', { name: 'Orient the model' })).toBeVisible();
    await expectNoViolations(page);
  });

  /**
   * `useLiveRelief` is deliberately not stage-gated (see
   * docs/DECISIONS.md): its debounce timer starts as soon as a model
   * loads, on Import, before the user ever navigates to Workspace -- so
   * by the time this test reaches Workspace, the first live generation
   * has often already landed (a few hundred ms of real navigation/
   * assertion time between the two steps is usually enough). This test
   * therefore checks accessibility on arrival at Workspace *regardless*
   * of which of the two states (placeholder vs. already-generated) it
   * happens to be in -- both are simple, static markup, so this is not a
   * meaningfully weaker check than pinning one specific state, and it
   * avoids a race the app's own live-regen design makes inherently
   * unreliable to force deterministically.
   */
  test('Workspace stage, immediately on arrival', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Concentric Ripple').click();
    await page.getByRole('button', { name: 'Continue to Workspace' }).click();
    await expect(page.getByRole('heading', { name: 'Workspace' })).toBeVisible();
    await expectNoViolations(page);
  });

  test('Workspace stage, after live regeneration has produced a result', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Concentric Ripple').click();
    await page.getByRole('button', { name: 'Continue to Workspace' }).click();
    await expect(page.getByRole('group', { name: 'Pattern view' })).toBeVisible({
      timeout: 15_000,
    });
    await expectNoViolations(page);
  });

  test('Workspace stage, including the opened Export & print panel', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Concentric Ripple').click();
    await page.getByRole('button', { name: 'Continue to Workspace' }).click();
    await expect(page.getByRole('group', { name: 'Pattern view' })).toBeVisible({
      timeout: 15_000,
    });

    await page.locator('.export-panel summary').click();
    await expect(page.locator('.export-panel[open]')).toBeVisible();
    await expectNoViolations(page);
  });
});
