import { test, expect } from '../fixtures/test-options';

test('AUTH-003 a locked user unlocks the account with the code from the email', async ({ page, loginPage, mailbox, testUser }) => {
  await test.step('GIVEN the user has entered a wrong password 5 times', async () => {
    await loginPage.open();
    for (let attempt = 1; attempt <= 5; attempt++) {
      await loginPage.logIn(testUser.email, 'Wrong#Pass1');
      await expect(loginPage.message).toHaveText('Invalid email or password.');
    }
    await expect(loginPage.codeField).toBeHidden();
  });

  await test.step('WHEN the user enters a wrong password a 6th time', async () => {
    await loginPage.logIn(testUser.email, 'Wrong#Pass1');
  });

  await test.step('THEN a code is emailed and the code field appears', async () => {
    await expect(loginPage.message).toContainText('We sent a verification code to your email.');
    await expect(loginPage.codeField).toBeVisible();
  });

  await test.step('AND the code from the email unlocks the account', async () => {
    const code = await mailbox.latestCode(testUser.email);
    const [verifyResponse] = await Promise.all([
      page.waitForResponse(r => r.url().endsWith('/api/auth/verify')),
      loginPage.enterCode(code)
    ]);
    // Check each step separately, so a failure says which one broke.
    expect(verifyResponse.status(), 'the code from the email is accepted').toBe(200);
    await expect
      .poll(async () => (await page.context().cookies()).some(c => c.name === 'bg_session'), { message: 'the browser keeps the login session cookie' })
      .toBe(true);
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByText(`Signed in as ${testUser.email}`)).toBeVisible();
  });
});
