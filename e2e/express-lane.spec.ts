import { expect, test } from '@playwright/test';

/**
 * EXP-011 ("Express lane: one screen from import to export, with Export
 * always visible"): link-only, so there's no self-assigned split to
 * exercise -- just that each of the two links the task brief hands out
 * (`?exp=EXP-011&v=rail`, `?exp=EXP-011&v=express`) produces the build it
 * names, and that a session with neither link keeps today's gated rail.
 * See `src/analytics/expressLane.ts` and docs/DECISIONS.md.
 */
test.describe('EXP-011 express lane', () => {
  test('a session with no link keeps the gated three-step rail', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Concentric Ripple').click();
    await page.getByRole('button', { name: /Create my pattern/ }).click();

    await expect(page.getByRole('navigation', { name: 'Pattern setup steps' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Shape the relief' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Choose your yarn' })).not.toBeVisible();
  });

  test('the rail link explicitly keeps the gated three-step rail', async ({ page }) => {
    await page.goto('/?exp=EXP-011&v=rail');
    await page.getByText('Concentric Ripple').click();
    await page.getByRole('button', { name: /Create my pattern/ }).click();

    await expect(page.getByRole('navigation', { name: 'Pattern setup steps' })).toBeVisible();
  });

  test('the express link opens Shape, Yarn and Export together, with Export visible once ready', async ({
    page,
  }) => {
    await page.goto('/?exp=EXP-011&v=express');
    await page.getByText('Concentric Ripple').click();
    await page.getByRole('button', { name: /Create my pattern/ }).click();

    await expect(page.getByRole('navigation', { name: 'Pattern setup steps' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /Back/ })).not.toBeVisible();

    await expect(page.getByRole('heading', { name: 'Shape the relief' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Choose your yarn' })).toBeVisible();

    // No click into an "Export" step is needed -- the panel appears on
    // this same screen as soon as the first relief has generated.
    await expect(page.getByText('Export & print')).toBeVisible();
  });
});
