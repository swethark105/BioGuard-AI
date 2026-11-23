import { test, expect } from '../fixtures/test-options';

// The upload page in a real browser (Chromium, Firefox and WebKit).

test('DATA-011 uploading the valid file shows the correct results', async ({ uploadPage }) => {
  await test.step('GIVEN the user is on the upload page', async () => {
    await uploadPage.open();
  });

  await test.step('WHEN the user uploads the valid samples file', async () => {
    await uploadPage.upload('valid-samples.csv');
  });

  await test.step('THEN every sample is shown with the right score and status', async () => {
    await expect(uploadPage.summary).toHaveText('5 samples: 3 PASS, 2 REVIEW');
    await expect(uploadPage.resultRows).toHaveCount(5);
    await expect(uploadPage.rowFor('RUN-001').locator('td')).toHaveText(['RUN-001', '0.91', 'PASS']);
    await expect(uploadPage.rowFor('RUN-004').locator('td')).toHaveText(['RUN-004', '0.78', 'REVIEW']);
  });
});

test('DATA-012 uploading a bad file shows a readable error', async ({ uploadPage }) => {
  await uploadPage.open();

  await uploadPage.upload('missing-value.csv');

  await expect(uploadPage.error).toHaveText('Line 2: signal_2 is missing.');
  await expect(uploadPage.resultRows).toHaveCount(0);
});