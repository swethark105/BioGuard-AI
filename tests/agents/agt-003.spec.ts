import { test, expect } from '../../fixtures/test-options';

test.describe('Sample Analysis Overview', () => {
  test('AGT-003 shows REVIEW for SYN-003 below the threshold', async ({ page, samplesPage }) => {
    // 1. Open the Sample Analysis Overview page.
    await samplesPage.open();
    await expect(samplesPage.heading).toBeVisible();
    await expect(samplesPage.rowFor('SYN-003')).toHaveCount(1);

    // 2. Locate SYN-003 and verify its signal quality and QC outcome.
    const syn003Row = samplesPage.rowFor('SYN-003');
    await expect(syn003Row.locator('td')).toHaveText(['SYN-003', '3000', '0.62', 'REVIEW']);

    // 3. Compare SYN-003's signal quality with the displayed threshold.
    await expect(page.getByText('Threshold for demo: signal quality ≥ 0.80 → PASS; otherwise REVIEW.')).toBeVisible();
    const signalQuality = Number(await syn003Row.locator('td').nth(2).innerText());
    expect(signalQuality).toBeLessThan(0.8);
    await expect(syn003Row.locator('td').nth(3)).not.toHaveText('PASS');
  });
});
