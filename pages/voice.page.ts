import { type Locator, type Page } from '@playwright/test';

/** The "Ask about this project" voice page: where things are, and what a user can do there. */
export class VoicePage {
  readonly questionInput: Locator;
  readonly askButton: Locator;
  readonly micButton: Locator;
  readonly micNote: Locator;
  readonly answer: Locator;
  readonly readmeLink: Locator;

  constructor(private readonly page: Page) {
    this.questionInput = page.getByLabel('Your question');
    this.askButton = page.getByRole('button', { name: 'Ask', exact: true });
    this.micButton = page.getByRole('button', { name: /Speak/ });
    this.micNote = page.getByText('Voice input works in Chrome and Edge');
    this.answer = page.getByRole('status');
    this.readmeLink = page.getByRole('link', { name: 'Read the full README' });
  }

  async open() {
    await this.page.goto('/voice');
  }

  /** Types a question and clicks Ask. */
  async ask(question: string) {
    await this.questionInput.fill(question);
    await this.askButton.click();
  }
}