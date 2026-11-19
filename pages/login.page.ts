import { type Locator, type Page } from '@playwright/test';

/** The login page: where things are, and what a user can do there. */
export class LoginPage {
  readonly email: Locator;
  readonly password: Locator;
  readonly logInButton: Locator;
  readonly codeField: Locator;
  readonly verifyButton: Locator;
  readonly resendButton: Locator;
  readonly message: Locator;

  constructor(private readonly page: Page) {
    this.email = page.getByLabel('Email');
    this.password = page.getByLabel('Password');
    this.logInButton = page.getByRole('button', { name: 'Log in' });
    this.codeField = page.getByLabel('Verification code');
    this.verifyButton = page.getByRole('button', { name: 'Verify' });
    this.resendButton = page.getByRole('button', { name: 'Resend code' });
    this.message = page.getByRole('alert');
  }

  async open() {
    await this.page.goto('/login');
  }

  async logIn(email: string, password: string) {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.logInButton.click();
  }

  async enterCode(code: string) {
    await this.codeField.fill(code);
    await this.verifyButton.click();
  }
}
