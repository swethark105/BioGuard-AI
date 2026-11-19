import { expect, type APIRequestContext } from '@playwright/test';

/**
 * Reads emails from Mailpit, the fake inbox the app sends to in test environments.
 * Mailpit API: https://mailpit.axllent.org/docs/api-v1/
 */
export class Mailbox {
  constructor(
    private readonly request: APIRequestContext,
    readonly baseUrl = process.env.MAILPIT_URL || 'http://localhost:8025'
  ) {}

  async isAvailable(): Promise<boolean> {
    try {
      return (await this.request.get(`${this.baseUrl}/api/v1/info`, { timeout: 3000 })).ok();
    } catch {
      return false;
    }
  }

  /** Emails sent to this address, newest first. */
  async messagesTo(email: string): Promise<{ ID: string; Subject: string }[]> {
    const response = await this.request.get(`${this.baseUrl}/api/v1/search`, { params: { query: `to:"${email}"` } });
    expect(response.ok(), 'Mailpit search failed').toBeTruthy();
    return (await response.json()).messages ?? [];
  }

  async count(email: string): Promise<number> {
    return (await this.messagesTo(email)).length;
  }

  /**
   * Waits until the address has received `expectedCount` emails, then returns the
   * 6-digit code from the newest one. Polls instead of using a fixed wait.
   */
  async latestCode(email: string, expectedCount = 1): Promise<string> {
    await expect
      .poll(() => this.count(email), { message: `Waiting for email ${expectedCount} to ${email}`, timeout: 15000 })
      .toBeGreaterThanOrEqual(expectedCount);
    const [newest] = await this.messagesTo(email);
    const message = await (await this.request.get(`${this.baseUrl}/api/v1/message/${newest.ID}`)).json();
    const code = /\b\d{6}\b/.exec(message.Text)?.[0];
    expect(code, `No 6-digit code in the email "${message.Subject}"`).toBeTruthy();
    return code!;
  }
}
