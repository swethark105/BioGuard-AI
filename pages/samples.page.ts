import type { Locator, Page } from '@playwright/test';

/**
 * Page object for the Sample Analysis Overview page (the home page).
 * It knows WHERE things are on the page and WHAT you can do there.
 */
export class SamplesPage {
  constructor(private readonly page: Page) {}

  // ==================== Locators ====================

  get heading(): Locator {
    return this.page.getByRole('heading', { name: 'Sample Analysis Overview' });
  }

  get sampleRows(): Locator {
    return this.page.locator('tbody tr');
  }

  // ==================== Actions ====================

  /** Opens the home page. */
  async open(): Promise<void> {
    await this.page.goto('/');
  }

  /**
   * Finds the table row for one sample.
   * @param sampleId - for example 'SYN-003'
   * @returns the row that contains that sample ID
   */
  rowFor(sampleId: string): Locator {
    return this.sampleRows.filter({ hasText: sampleId });
  }
}
