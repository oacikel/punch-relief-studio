import { expect, test } from '@playwright/test';

/**
 * EXP-012 ("One-click pattern recipes that preset shape, detail and yarn
 * palette"): after loading a model, the Import/Orient screen offers five
 * named recipe cards -- each applies a full shape/detail/palette preset in
 * one click and lands the maker directly on the Workspace rail's Export
 * step, skipping the Shape/Yarn steps entirely. See
 * `src/domain/pattern/recipes.ts` and docs/DECISIONS.md.
 */
test.describe('EXP-012 pattern recipes', () => {
  test('a recipe card jumps straight to the Export step, skipping Shape and Yarn', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByText('Concentric Ripple').click();

    await expect(page.getByRole('heading', { name: 'Start from a recipe' })).toBeVisible();
    await page.getByRole('button', { name: /Cozy Terrain/ }).click();

    await expect(page.getByRole('button', { name: '3 Export' })).toHaveAttribute(
      'aria-current',
      'step',
    );
    await expect(page.getByRole('heading', { name: 'Shape the relief' })).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Choose your yarn' })).not.toBeVisible();

    // The real export panel replaces the "not ready yet" placeholder once
    // the recipe's relief has finished generating.
    await expect(page.getByText('Export & print')).toBeVisible();
  });

  test('the plain "Create my pattern" button still opens on the Shape step', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Concentric Ripple').click();
    await page.getByRole('button', { name: /Create my pattern/ }).click();

    await expect(page.getByRole('button', { name: '1 Shape' })).toHaveAttribute(
      'aria-current',
      'step',
    );
    await expect(page.getByRole('heading', { name: 'Shape the relief' })).toBeVisible();
  });
});
