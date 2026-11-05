import { test, expect } from '../../fixtures/test-options';

test.describe('Sample Analysis Overview', () => {
  test('AGT-002 classifies SYN-002 as PASS just above the threshold', async ({ page, samplesPage }) => {
    // 1. Start from a fresh browser state and open the Sample Analysis Overview page.
    await samplesPage.open();
    await expect(samplesPage.heading).toBeVisible();
    await expect(samplesPage.rowFor('SYN-002')).toHaveCount(1);

    // 2. Locate SYN-002 and verify its signal quality and QC outcome.
    const syn002Row = samplesPage.rowFor('SYN-002');
    await expect(syn002Row.locator('td')).toHaveText(['SYN-002', '550', '0.81', 'PASS']);

    // 3. Compare SYN-002's signal quality with the displayed threshold.
    await expect(page.getByText('Threshold for demo: signal quality ≥ 0.80 → PASS; otherwise REVIEW.')).toBeVisible();
    const signalQuality = Number(await syn002Row.locator('td').nth(2).innerText());
    expect(signalQuality).toBeGreaterThan(0.8);
    await expect(syn002Row.locator('td').nth(3)).not.toHaveText('REVIEW');
  });
});
