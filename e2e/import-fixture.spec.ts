import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Imports a small, legally-generated local STL fixture (e2e/fixtures/cube.stl,
 * a hand-authored 12-triangle cube) and confirms the app accepts it and
 * advances to the Orient stage. NOT YET RUN in this session -- see
 * docs/TEST_REPORT.md.
 */
test('imports a local STL fixture via the file picker', async ({ page }) => {
  await page.goto('/');
  const fileInput = page.getByLabel('Choose model files to import');
  await fileInput.setInputFiles(path.join(here, 'fixtures', 'cube.stl'));
  await expect(page.getByRole('heading', { name: 'Orient the model' })).toBeVisible({
    timeout: 10_000,
  });
});
