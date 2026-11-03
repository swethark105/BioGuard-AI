import { test as base, expect } from '@playwright/test';
import { SamplesPage } from '../pages/samples.page';

type PageFixtures = {
  samplesPage: SamplesPage;
};

/**
 * Our own `test`. It works like Playwright's normal `test`,
 * but tests can also ask for `samplesPage`.
 *
 * When a test writes `async ({ samplesPage }) => ...`, Playwright:
 *   1. gets the `page` (the browser tab), as usual
 *   2. builds a SamplesPage from it
 *   3. hands it to the test
 */
export const test = base.extend<PageFixtures>({
  samplesPage: async ({ page }, use) => {
    await use(new SamplesPage(page));
  },
});

export { expect };
