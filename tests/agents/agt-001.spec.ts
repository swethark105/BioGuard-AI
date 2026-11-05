import { test, expect } from '../../fixtures/test-options';

test.describe('Sample Analysis Overview', () => {
  test('AGT-001 displays all expected sample values and outcomes', async ({ page, samplesPage }) => {
    // 1. Start from a fresh browser state and run tests/seed.spec.ts to open the Sample Analysis Overview page.
    await samplesPage.open();
    await expect(samplesPage.heading).toBeVisible();

    // 2. Inspect the sample table and verify that it contains exactly three data rows, one for each expected sample.
    await expect(samplesPage.sampleRows).toHaveCount(3);
    await expect(samplesPage.sampleRows).toContainText(['SYN-001', 'SYN-002', 'SYN-003']);

    // 3. Check the SYN-001 row across Sample ID, Fragment length, Signal quality, and QC outcome.
    await expect(samplesPage.rowFor('SYN-001').locator('td')).toHaveText(['SYN-001', '1200', '0.95', 'PASS']);

    // 4. Check the SYN-002 row across those columns.
    await expect(samplesPage.rowFor('SYN-002').locator('td')).toHaveText(['SYN-002', '550', '0.81', 'PASS']);

    // 5. Check the SYN-003 row across those columns.
    await expect(samplesPage.rowFor('SYN-003').locator('td')).toHaveText(['SYN-003', '3000', '0.62', 'REVIEW']);

    // 6. Read the threshold note displayed beneath the table.
    await expect(page.getByText('Threshold for demo: signal quality ≥ 0.80 → PASS; otherwise REVIEW.')).toBeVisible();
  });
});
