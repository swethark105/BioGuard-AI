import { test, expect } from '../../fixtures/test-options';

test.describe('Sample Analysis Overview', () => {
  test('AGT-004 verifies page identity, disclaimer and read-only structure', async ({ page, samplesPage }) => {
    // 1. Open the page and check its identity.
    await samplesPage.open();
    await expect(page).toHaveTitle('BioGuard AI | Synthetic Lab');
    await expect(page.getByRole('heading', { level: 1, name: 'BioGuard AI' })).toBeVisible();
    await expect(page.getByText('Synthetic Biotech Sample Quality Engineering Demo')).toBeVisible();

    // 2. Check the fictional-data disclaimer.
    await expect(page.getByText('Fictional data only. Not a medical or diagnostic application.')).toBeVisible();

    // 3. Check the table headers, in order.
    await expect(page.locator('thead th')).toHaveText(['Sample ID', 'Fragment length', 'Signal quality', 'QC outcome']);

    // 4. The overview is read-only: wait for the rows, then check for interactive controls.
    await expect(samplesPage.sampleRows).toHaveCount(3);
    await expect(page.locator('a, button, input, select, textarea')).toHaveCount(0);
  });
});
