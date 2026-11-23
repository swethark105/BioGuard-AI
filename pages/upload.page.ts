import { type Locator, type Page } from '@playwright/test';
import path from 'node:path';

/** The "Upload instrument data" page: where things are, and what a user can do there. */
export class UploadPage {
  readonly fileInput: Locator;
  readonly uploadButton: Locator;
  readonly error: Locator;
  readonly summary: Locator;
  readonly resultRows: Locator;

  constructor(private readonly page: Page) {
    this.fileInput = page.getByLabel('CSV file');
    this.uploadButton = page.getByRole('button', { name: 'Upload' });
    this.error = page.getByRole('alert');
    this.summary = page.getByRole('status');
    this.resultRows = page.locator('#results tbody tr');
  }

  async open() {
    await this.page.goto('/upload');
  }

  /** Uploads one of the files in tests/data, for example 'valid-samples.csv'. */
  async upload(fileName: string) {
    await this.fileInput.setInputFiles(path.join('tests', 'data', fileName));
    await this.uploadButton.click();
  }

  /** The table row for one sample, found by its ID. */
  rowFor(sampleId: string): Locator {
    return this.resultRows.filter({ hasText: sampleId });
  }
}