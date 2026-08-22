import { expect, test } from '@playwright/test';

/**
 * Iteration 02 Stage C coverage: the on-screen label toggle (independent
 * of the existing "Print region labels" export checkbox) and the
 * punch-guide selector/spacing control on Preview. See
 * docs/ITERATION_02_PLAN.md §8/§9/§10 and docs/DECISIONS.md for the design
 * interpretation and schema decision.
 *
 * Deep SVG-content assertions (whether the rendered pattern actually
 * contains a `data-layer="punch-guide"` group, correct dot counts, etc.)
 * are covered by unit tests in `src/export/__tests__/svgPattern.test.ts`
 * and `src/domain/pattern/__tests__/punchGuide.test.ts` -- this spec
 * follows the established e2e style (see `e2e/relief-workspace.spec.ts`)
 * of asserting on-screen UI state/visibility rather than parsing exported
 * SVG markup.
 */
test.describe('Preview controls (Iteration 02 Stage C)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByText('Concentric Ripple').click();
    await page.getByRole('button', { name: '2. Create relief' }).click();
    await page.getByRole('button', { name: 'Generate relief' }).click();
    await expect(page.getByRole('heading', { name: 'Height levels' })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('button', { name: '5. Preview' }).click();
    await expect(page.getByRole('heading', { name: 'Preview the finished piece' })).toBeVisible();
  });

  test('on-screen "Region labels" toggle is independent of the export "Print region labels" toggle', async ({
    page,
  }) => {
    const onScreenLabels = page.getByRole('checkbox', { name: 'Region labels (C1-H1 etc.)' });
    await expect(onScreenLabels).toBeChecked(); // on by default -- preserves pre-Stage-C behavior

    await onScreenLabels.uncheck();
    await expect(onScreenLabels).not.toBeChecked();

    // The export panel's own, separate label checkbox is unaffected --
    // still defaults on, since these are two independent settings.
    await page.getByText('Export & print').click();
    const printLabels = page.getByRole('checkbox', { name: /Print region labels/i });
    await expect(printLabels).toBeChecked();
  });

  test('selecting "Dots" reveals the spacing input; "None" hides it again', async ({ page }) => {
    const guideSelect = page.getByLabel('Punch guide');
    await expect(guideSelect).toHaveValue('none');
    await expect(page.getByLabel('Dot spacing (cm)')).toBeHidden();

    await guideSelect.selectOption('dots');
    const spacing = page.getByLabel('Dot spacing (cm)');
    await expect(spacing).toBeVisible();
    await expect(spacing).toHaveValue('1'); // default spacing

    await guideSelect.selectOption('none');
    await expect(page.getByLabel('Dot spacing (cm)')).toBeHidden();
  });

  test('dot spacing input holds a user-entered value within range', async ({ page }) => {
    await page.getByLabel('Punch guide').selectOption('dots');
    const spacing = page.getByLabel('Dot spacing (cm)');
    await spacing.fill('2.5');
    await spacing.blur();
    await expect(spacing).toHaveValue('2.5');
  });

  test("the export panel has no duplicate punch-guide control of its own (Preview's setting is shared, not re-entered)", async ({
    page,
  }) => {
    await page.getByLabel('Punch guide').selectOption('dots');
    await page.getByLabel('Dot spacing (cm)').fill('1.5');

    // Export panel reuses whatever was set on Preview rather than exposing
    // a second, separate "Punch guide" selector of its own.
    await page.getByText('Export & print').click();
    const exportPanel = page.locator('.export-panel');
    await expect(exportPanel.getByLabel('Punch guide')).toHaveCount(0);
    await expect(exportPanel.getByLabel('Dot spacing (cm)')).toHaveCount(0);
  });
});
