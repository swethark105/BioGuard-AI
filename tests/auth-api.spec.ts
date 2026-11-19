import { type APIRequestContext } from '@playwright/test';
import { test, expect } from '../fixtures/test-options';

// Login lockout rules, tested through the API (fast and stable).
// Every test gets a fresh user, so lockout state never carries over.
// The full browser journey is AUTH-003 in auth-ui.spec.ts.

const WRONG_PASSWORD = 'Wrong#Pass1';
const INVALID = 'Invalid email or password.';

const login = async (request: APIRequestContext, email: string, password: string) => {
  const r = await request.post('/api/auth/login', { data: { email, password } });
  return { status: r.status(), body: await r.json() };
};
const verify = async (request: APIRequestContext, email: string, code: string) => {
  const r = await request.post('/api/auth/verify', { data: { email, code } });
  return { status: r.status(), body: await r.json() };
};
const resend = async (request: APIRequestContext, email: string) =>
  (await request.post('/api/auth/resend', { data: { email } })).status();

/** Fails `times` logins in a row and returns the last response. */
async function failLogins(request: APIRequestContext, email: string, times: number) {
  let last = { status: 0, body: {} as Record<string, string> };
  for (let attempt = 1; attempt <= times; attempt++) last = await login(request, email, WRONG_PASSWORD);
  return last;
}

/** A code that is guaranteed to be wrong. */
const otherCode = (code: string) => (code === '000000' ? '111111' : '000000');

test.describe('Login lockout and email code (API)', () => {
  test('AUTH-001 5 failed logins show an error and send no code', async ({ request, mailbox, testUser }) => {
    for (let attempt = 1; attempt <= 5; attempt++) {
      const r = await login(request, testUser.email, WRONG_PASSWORD);
      expect(r.status, `attempt ${attempt}`).toBe(401);
      expect(r.body.message).toBe(INVALID);
    }
    expect(await mailbox.count(testUser.email)).toBe(0);
  });

  test('AUTH-002 6th failed login locks the account and emails a 6-digit code', async ({ request, mailbox, testUser }) => {
    const sixth = await failLogins(request, testUser.email, 6);
    expect(sixth.status).toBe(423);
    expect(sixth.body.status).toBe('code_required');
    expect(sixth.body.message).toContain('sent a verification code');

    const [email] = await mailbox.messagesTo(testUser.email);
    expect(email.Subject).toBe('Your BioGuard AI verification code');
    expect(await mailbox.latestCode(testUser.email)).toMatch(/^\d{6}$/);
    expect(await mailbox.count(testUser.email)).toBe(1);
  });

  test('AUTH-004 a wrong code is rejected and the account stays locked', async ({ request, mailbox, testUser }) => {
    await failLogins(request, testUser.email, 6);
    const code = await mailbox.latestCode(testUser.email);

    const r = await verify(request, testUser.email, otherCode(code));
    expect(r.status).toBe(400);
    expect(r.body.status).toBe('invalid_code');
    expect((await login(request, testUser.email, testUser.password)).status).toBe(423);
  });

  test('AUTH-005 an expired code is rejected; a new code works', async ({ request, mailbox, testUser }) => {
    await failLogins(request, testUser.email, 6);
    const oldCode = await mailbox.latestCode(testUser.email);

    // Test-support endpoint: moves the code past its lifetime instead of waiting 10 minutes.
    expect((await request.post('/api/test-support/expire-code', { data: { email: testUser.email } })).ok()).toBeTruthy();
    const expired = await verify(request, testUser.email, oldCode);
    expect(expired.status).toBe(400);
    expect(expired.body.status).toBe('expired_code');

    expect(await resend(request, testUser.email)).toBe(202);
    const newCode = await mailbox.latestCode(testUser.email, 2);
    expect((await verify(request, testUser.email, newCode)).status).toBe(200);
  });

  test('AUTH-006 an older or already used code cannot be used', async ({ request, mailbox, testUser }) => {
    await failLogins(request, testUser.email, 6);
    const firstCode = await mailbox.latestCode(testUser.email);
    await resend(request, testUser.email);
    const secondCode = await mailbox.latestCode(testUser.email, 2);
    test.skip(firstCode === secondCode, 'Both random codes were identical (1 in a million)');

    expect((await verify(request, testUser.email, firstCode)).status, 'older code').toBe(400);
    expect((await verify(request, testUser.email, secondCode)).status, 'newest code').toBe(200);
    expect((await verify(request, testUser.email, secondCode)).status, 'same code again').toBe(400);
  });

  test('AUTH-007 the correct password while locked still requires the code', async ({ request, mailbox, testUser }) => {
    await failLogins(request, testUser.email, 6);
    await mailbox.latestCode(testUser.email);

    const r = await login(request, testUser.email, testUser.password);
    expect(r.status).toBe(423);
    expect(r.body.status).toBe('code_required');
    expect(await mailbox.count(testUser.email), 'no extra email').toBe(1);
  });

  test('AUTH-008 login does not reveal whether an account exists', async ({ request, testUser }) => {
    const unknownEmail = `nobody-${Date.now()}@bioguard.test`;
    const known = await login(request, testUser.email, WRONG_PASSWORD);
    const unknown = await login(request, unknownEmail, WRONG_PASSWORD);
    expect(unknown.status).toBe(known.status);
    expect(unknown.body).toEqual(known.body);

    // An unknown address never "locks", which would also reveal something.
    const sixthUnknown = await failLogins(request, unknownEmail, 6);
    expect(sixthUnknown.status).toBe(401);
    expect(sixthUnknown.body.message).toBe(INVALID);
  });

  test('AUTH-009 a successful login resets the failed-attempt counter', async ({ request, mailbox, testUser }) => {
    await failLogins(request, testUser.email, 4);
    expect((await login(request, testUser.email, testUser.password)).status).toBe(200);

    const fifth = await failLogins(request, testUser.email, 5);
    expect(fifth.status, '5 failures after the reset').toBe(401);
    expect(await mailbox.count(testUser.email)).toBe(0);

    expect((await login(request, testUser.email, WRONG_PASSWORD)).status, '6th failure after the reset').toBe(423);
  });

  test('AUTH-010 5 wrong codes cancel the code until a new one is requested', async ({ request, mailbox, testUser }) => {
    await failLogins(request, testUser.email, 6);
    const code = await mailbox.latestCode(testUser.email);

    for (let attempt = 1; attempt <= 5; attempt++) await verify(request, testUser.email, otherCode(code));
    const blocked = await verify(request, testUser.email, code);
    expect(blocked.status, 'even the correct code is refused now').toBe(400);
    expect(blocked.body.status).toBe('too_many_codes');

    await resend(request, testUser.email);
    const newCode = await mailbox.latestCode(testUser.email, 2);
    expect((await verify(request, testUser.email, newCode)).status).toBe(200);
  });
});
