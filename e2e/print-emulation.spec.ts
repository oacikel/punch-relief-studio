import { expect, test } from '@playwright/test';

/**
 * Iteration 02 Stage D coverage: print/PDF reliability. §2 item 1 of
 * docs/ITERATION_02_PLAN.md notes that no e2e test previously exercised
 * actual print-media emulation -- every prior spec only checked on-screen
 * state. This spec drives the app to the combined Workspace (formerly a
 * separate "Preview" stage -- see docs/ITERATION_03_PLAN.md #13), sets up
 * a scenario that requires multi-page tiling with an active punch-guide
 * overlay (the exact 60cm x 60cm.../A4/0.5cm-spacing combination this
 * session's manual investigation reproduced and pixel-verified in a real
 * headless Chromium PDF render -- see docs/ITERATION_02_PLAN.md's Stage D
 * section), then emulates print media and inspects the actual print
 * output: the print stylesheet correctly hides app chrome, the
 * punch-guide dot grid and the "5cm scale check" square both actually
 * appear in the printed SVG, and (Chromium only, since Playwright only
 * supports `page.pdf()` on headless Chromium) a real rendered PDF has the
 * expected page count.
 */
test.describe('Print/PDF output (Iteration 02 Stage D)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByText('Concentric Ripple').click();
    await page.getByRole('button', { name: 'Continue to Workspace' }).click();
    await expect(page.getByRole('group', { name: 'Pattern view' })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByLabel('Color by height').check();

    // Punch guide: Dots at a small spacing, so a realistic-density dot
    // grid actually reaches the print output.
    await page.locator('#punch-guide-mode').selectOption('dots');
    await page.locator('#punch-guide-spacing').fill('0.5');

    // Dimensions large enough on A4 (the default page size) to force
    // multi-page tiling -- matches the fixture in
    // src/export/__tests__/printTiling.test.ts (60cm x 40cm, a4, 1cm
    // overlap -> 4 cols x 2 rows = 8 pages) so the e2e and unit coverage
    // are provably exercising the same scenario.
    await page.locator('.export-panel summary').click();
    await page.getByLabel('Width (cm)').fill('60');
    await page.getByLabel('Height (cm)').fill('40');
  });

  test('tiles the pattern across the expected number of pages', async ({ page }) => {
    await expect(page.getByText(/This pattern will print across 8 pages \(4 × 2\)/)).toBeVisible();
    await expect(page.locator('.print-page')).toHaveCount(8);
  });

  test('print media hides app chrome and shows only .print-pages', async ({ page }) => {
    await page.emulateMedia({ media: 'print' });

    await expect(page.locator('.app-header')).toBeHidden();
    await expect(page.locator('.stage-nav')).toBeHidden();
    // As of Iteration 03's combined-workspace change, `.screen-only` wraps
    // two separate elements on Workspace (the rail's controls and the
    // sticky preview column -- see docs/DECISIONS.md), so a single-element
    // `toBeHidden()` would be a strict-mode violation. Assert none of the
    // matched elements are visible instead.
    await expect(page.locator('.screen-only:visible')).toHaveCount(0);
    await expect(page.locator('.print-pages')).toBeVisible();
  });

  test('the printed pattern SVG contains both the punch-guide dot grid and the scale-check square', async ({
    page,
  }) => {
    await page.emulateMedia({ media: 'print' });
    const firstPageImg = page.locator('.print-page img').first();
    await expect(firstPageImg).toBeVisible();

    const svgContent = await page.evaluate(async () => {
      const img = document.querySelector('.print-page img') as HTMLImageElement | null;
      if (!img?.src) return null;
      const response = await fetch(img.src);
      return response.text();
    });

    expect(svgContent).not.toBeNull();
    expect(svgContent).toContain('data-layer="punch-guide"');
    expect(svgContent).toMatch(/<circle /);
    expect(svgContent).toContain('5 cm scale check');
    // Paint-order invariant (also unit-tested in svgPattern.test.ts): the
    // punch guide must be painted before the scale bar, so the scale
    // square is never hidden underneath the dot grid.
    expect(svgContent?.indexOf('data-layer="punch-guide"')).toBeLessThan(
      svgContent?.indexOf('data-layer="scale"') ?? -1,
    );
  });

  test('turning the punch guide off removes the dot grid from the printed SVG (regression)', async ({
    page,
  }) => {
    await page.locator('#punch-guide-mode').selectOption('none');
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.print-page img').first()).toBeVisible();

    const svgContent = await page.evaluate(async () => {
      const img = document.querySelector('.print-page img') as HTMLImageElement | null;
      if (!img?.src) return null;
      const response = await fetch(img.src);
      return response.text();
    });

    expect(svgContent).not.toBeNull();
    expect(svgContent).not.toContain('data-layer="punch-guide"');
  });

  /**
   * Iteration 03 Round 1 (docs/ITERATION_03_PLAN.md #11): the export/print
   * panel no longer has its own "Print region labels" checkbox -- it
   * reads Preview's on-screen "Region labels" toggle directly. This is
   * the content-level proof that wiring actually reaches the printed
   * SVG, not just that the duplicate checkbox is gone from the DOM
   * (covered separately in e2e/preview-controls.spec.ts).
   */
  test('turning off the on-screen "Region labels" toggle removes labels from the printed SVG too', async ({
    page,
  }) => {
    await page.getByRole('checkbox', { name: 'Region labels (C1-H1 etc.)' }).uncheck();
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.print-page img').first()).toBeVisible();

    const svgContent = await page.evaluate(async () => {
      const img = document.querySelector('.print-page img') as HTMLImageElement | null;
      if (!img?.src) return null;
      const response = await fetch(img.src);
      return response.text();
    });

    expect(svgContent).not.toBeNull();
    expect(svgContent).not.toContain('data-layer="labels"');
  });

  test('"Actual project size" page setting no longer crashes the app (Stage D regression)', async ({
    page,
  }) => {
    // Iteration 02 Stage D found this crashed the whole app past the
    // top-level ErrorBoundary -- computeTiling() threw because
    // ExportPanel never passed actualSizeCm. Fixed in ExportPanel.tsx;
    // this is the end-to-end confirmation the fix holds through a real
    // browser session, not just the component-level regression test in
    // ExportPanel.test.tsx.
    await page.locator('#page-size').selectOption('actual-size');
    await expect(page.getByRole('heading', { name: 'Something went wrong' })).not.toBeVisible();
    await expect(page.locator('.print-page')).toHaveCount(1);
  });

  test('a tiny "Actual project size" pattern (below the default margin+overlap) does not crash the app (deeper Stage D regression)', async ({
    page,
  }) => {
    // A second, deeper crash the same investigation found: computeTiling
    // validated overlap against a margin-derived printable area
    // unconditionally, even for 'actual-size', where no physical margin
    // or overlap concept applies at all -- a small pattern like 1cm x 1cm
    // tripped "overlap is too large for the printable page area". Fixed
    // in printTiling.ts by short-circuiting on pageSize === 'actual-size'
    // before that validation runs.
    await page.getByLabel('Width (cm)').fill('1');
    await page.getByLabel('Height (cm)').fill('1');
    await page.locator('#page-size').selectOption('actual-size');
    await expect(page.getByRole('heading', { name: 'Something went wrong' })).not.toBeVisible();
    await expect(page.locator('.print-page')).toHaveCount(1);
  });

  test('renders an actual PDF with the expected page count', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'PDF generation is Chromium-only in Playwright');

    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.print-page img').first()).toBeVisible();

    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    expect(pdfBuffer.byteLength).toBeGreaterThan(0);

    // Coarse page-count check via the PDF's own page objects -- avoids a
    // new PDF-parsing dependency. Verified against a known-8-page PDF
    // during this session's manual investigation. The DOM-level
    // `.print-page` count assertion above is the primary, more robust
    // check; this is a secondary confirmation that an actual rendered PDF
    // matches it.
    const pageObjectMatches = pdfBuffer.toString('latin1').match(/\/Type\s*\/Page(?!s)/g) ?? [];
    expect(pageObjectMatches.length).toBe(8);
  });
});
