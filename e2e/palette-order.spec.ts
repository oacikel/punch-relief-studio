import { expect, test } from '@playwright/test';

/**
 * EXP-002 ("move yarn palette selection earlier"): unlike this app's other
 * self-assigned experiments, an unassigned session defaults to `control`
 * (today's Shape-then-Yarn order), not the `earlier` treatment -- see
 * `src/analytics/paletteOrder.ts` and docs/DECISIONS.md.
 *
 * This runs against the public build, where analytics is unconfigured (no
 * `VITE_VP_INGEST_URL`/`VITE_VP_PROJECT_TOKEN`), so `shouldMoveYarnColors
 * Earlier()` returns false for every session there -- this guards against
 * that default silently flipping, which would reorder the rail for
 * everyone with no measurement behind it.
 */
test.describe('EXP-002 palette order (control default)', () => {
  test('opens the Workspace rail on Shape, with Yarn second', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Concentric Ripple').click();
    await page.getByRole('button', { name: /Create my pattern/ }).click();

    await expect(page.getByRole('heading', { name: 'Make it punchable' })).toBeVisible();
    await expect(page.getByRole('button', { name: '1 Shape' })).toHaveAttribute(
      'aria-current',
      'step',
    );
    await expect(page.getByRole('heading', { name: 'Shape the relief' })).toBeVisible();
    await expect(page.getByRole('button', { name: '2 Yarn' })).toBeVisible();

    await page.getByRole('button', { name: '2 Yarn' }).click();
    await expect(page.getByRole('heading', { name: 'Choose your yarn' })).toBeVisible();
  });
});
