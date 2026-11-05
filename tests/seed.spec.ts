import { test, expect } from '../fixtures/test-options';

/**
 * Seed test for the Playwright agents (planner, generator, healer).
 *
 * The agents run this first to get a ready page, then explore or write
 * tests from there. Keep it short: it only opens the Sample Analysis
 * Overview page through the existing page object.
 *
 * It also runs in the normal suite as a quick smoke check (REQ-001).
 */
test.describe('Seed', () => {
  test('SEED-001 opens the sample analysis overview page', async ({ samplesPage }) => {
    await samplesPage.open();
    await expect(samplesPage.heading).toBeVisible();
  });
});
