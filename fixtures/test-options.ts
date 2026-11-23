import { test as base, expect } from '@playwright/test';
import { SamplesPage } from '../pages/samples.page';
import { LoginPage } from '../pages/login.page';
import { UploadPage } from '../pages/upload.page'; // NEW (a)
import { VoicePage } from '../pages/voice.page';
import { Mailbox } from '../tests/helpers/mailbox';

export type TestUser = { email: string; password: string };

type Fixtures = {
  samplesPage: SamplesPage;
  loginPage: LoginPage;
  uploadPage: UploadPage; // NEW (b)
  voicePage: VoicePage;
  mailbox: Mailbox;
  testUser: TestUser;
};

/**
 * Our own `test`. It works like Playwright's normal `test`,
 * but tests can also ask for these ready-made helpers.
 *
 * When a test writes `async ({ samplesPage }) => ...`, Playwright:
 *   1. gets the `page` (the browser tab), as usual
 *   2. builds a SamplesPage from it
 *   3. hands it to the test
 */
export const test = base.extend<Fixtures>({
  samplesPage: async ({ page }, use) => {
    await use(new SamplesPage(page));
  },

  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  voicePage: async ({ page }, use) => {
    await use(new VoicePage(page));
  },
  // NEW (c): hands tests a ready-made UploadPage
  uploadPage: async ({ page }, use) => {
    await use(new UploadPage(page));
  },

  // The fake inbox. Docker and CI always run Mailpit (REQUIRE_MAILPIT=true);
  // on a laptop without it, the login tests are skipped with instructions.
  mailbox: async ({ request }, use) => {
    const mailbox = new Mailbox(request);
    if (!(await mailbox.isAvailable())) {
      if (process.env.REQUIRE_MAILPIT === 'true') throw new Error(`Mailpit is not reachable at ${mailbox.baseUrl}`);
      test.skip(true, `Mailpit is not running at ${mailbox.baseUrl}. Start it with: docker compose up -d mailpit`);
    }
    await use(mailbox);
  },

  // A brand-new account for every test, so lockout state never carries over.
  testUser: async ({ request }, use) => {
    const user = {
      email: `qa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@bioguard.test`,
      password: 'Correct#Pass1'
    };
    const response = await request.post('/api/test-support/users', { data: user });
    expect(response.status(), 'Could not create a test user').toBe(201);
    await use(user);
  }
});

export { expect };