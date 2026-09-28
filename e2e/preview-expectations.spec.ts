import { expect, test } from '@playwright/test';

/**
 * EXP-003 ("clarify the single-viewpoint preview"): the notice appears on the
 * Import/Orient step -- before the Workspace preview exists -- states what the
 * exported sheet will and won't contain, and never gets between the person and
 * "Create my pattern".
 *
 * This runs against the public build, where analytics is unconfigured (no
 * `VITE_VP_INGEST_URL`/`VITE_VP_PROJECT_TOKEN`), so
 * `shouldShowPreviewExpectations()` returns true for every session -- there is
 * no measurement here to hold a control group back for. See
 * src/analytics/previewExpectations.ts.
 */
const NOTICE_HEADING = 'What your pattern will show';

test.describe('EXP-003 preview expectations', () => {
  test('appears before the preview, while the model is still turnable', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Concentric Ripple').click();

    const notice = page.getByRole('region', { name: NOTICE_HEADING });
    await expect(notice).toBeVisible();
    await expect(notice.getByRole('listitem')).toHaveCount(3);
    await expect(notice).toContainText('This one view');
    await expect(notice).toContainText('H1, H2');
    await expect(notice).toContainText('No undercuts');
    await expect(notice).toContainText('What you export is this same single view');

    // Set *before* the preview: no Workspace pattern on screen yet, and the
    // rotation controls the notice tells the person to use are right there.
    await expect(page.getByRole('heading', { name: 'Make it punchable' })).toHaveCount(0);
    await expect(page.getByRole('group', { name: 'Standard views' })).toBeVisible();

    // It replaces the one-line version rather than stacking on top of it.
    await expect(page.getByText(/single-viewpoint relief rather than a full 3D/i)).toHaveCount(0);
  });

  test('does not block continuing to the pattern, and does not follow the user there', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByText('Concentric Ripple').click();
    await expect(page.getByRole('region', { name: NOTICE_HEADING })).toBeVisible();

    await page.getByRole('button', { name: /Create my pattern/ }).click();

    await expect(page.getByRole('heading', { name: 'Make it punchable' })).toBeVisible();
    // Expectation-setting happens once, before the preview -- it isn't
    // repeated in the Workspace rail.
    await expect(page.getByRole('region', { name: NOTICE_HEADING })).toHaveCount(0);
  });
});
