import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Iteration 03 Round 2 #5: automated accessibility sweep across the app's
 * five main stages, using axe-core. docs/LIMITATIONS.md previously recorded
 * that no automated axe-core run had ever been executed -- originally
 * because no browser was available in the sandbox that built this MVP, not
 * because of a product decision. This closes that gap for real: each test
 * below fails on any actual violation axe-core finds (not a smoke test that
 * always passes), scoped to the WCAG 2.0/2.1 A and AA rule sets plus
 * axe-core's general best-practice rules.
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

  test('Relief stage', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Concentric Ripple').click();
    await page.getByRole('button', { name: '2. Create relief' }).click();
    await expect(page.getByRole('heading', { name: 'Create the relief' })).toBeVisible();
    await expectNoViolations(page);
  });

  test('Height levels stage', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Concentric Ripple').click();
    await page.getByRole('button', { name: '2. Create relief' }).click();
    await page.getByRole('button', { name: 'Generate relief' }).click();
    await expect(page.getByRole('heading', { name: 'Height levels' })).toBeVisible({
      timeout: 15_000,
    });
    await expectNoViolations(page);
  });

  test('Yarn colors stage', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Concentric Ripple').click();
    await page.getByRole('button', { name: '2. Create relief' }).click();
    await page.getByRole('button', { name: 'Generate relief' }).click();
    await expect(page.getByRole('heading', { name: 'Height levels' })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('button', { name: '4. Yarn colors' }).click();
    await expect(page.getByRole('heading', { name: 'Yarn colors' })).toBeVisible();
    await expectNoViolations(page);
  });

  test('Preview stage, including the opened Export & print panel', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Concentric Ripple').click();
    await page.getByRole('button', { name: '2. Create relief' }).click();
    await page.getByRole('button', { name: 'Generate relief' }).click();
    await expect(page.getByRole('heading', { name: 'Height levels' })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('button', { name: '5. Preview' }).click();
    await expect(page.getByRole('heading', { name: 'Preview the finished piece' })).toBeVisible();
    await expectNoViolations(page);

    await page.getByText('Export & print').click();
    await expect(page.locator('.export-panel[open]')).toBeVisible();
    await expectNoViolations(page);
  });
});
