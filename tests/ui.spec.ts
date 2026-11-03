import { test, expect } from '../fixtures/test-options';

test('UI-001 displays three fictional samples', async ({ samplesPage }) => {
  await samplesPage.open();
  await expect(samplesPage.heading).toBeVisible();
  await expect(samplesPage.sampleRows).toHaveCount(3);
  await expect(samplesPage.rowFor('SYN-001')).toBeVisible();
});

test('UI-002 displays review classification', async ({ samplesPage }) => {
  await samplesPage.open();
  await expect(samplesPage.rowFor('SYN-003')).toContainText('REVIEW');
});
