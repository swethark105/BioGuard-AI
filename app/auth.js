// Login with account lockout and an email verification code.
//
// Rules (the feature under test):
// - Wrong password attempts 1 to 5 show "Invalid email or password."
// - The 6th wrong attempt locks the account and emails a 6-digit code.
// - While locked, only a valid, unexpired, unused code unlocks the account,
//   even if the correct password is entered.
// - 5 wrong codes cancel the code; the user must request a new one.
// - A new code (resend) replaces the old one; at most 3 resends per lockout.
// - A successful login resets the failed-attempt counter to 0.
// - Unknown emails get exactly the same response as a wrong password, so the
//   login form never reveals which accounts exist.
//
// All state is in memory: it resets when the app restarts. Fictional demo only.
import crypto from 'node:crypto';
import { sendEmail } from './mailer.js';

export const RULES = {
  maxFailedAttempts: 5,        // the 6th failed attempt triggers the code
  codeLifetimeSeconds: Number(process.env.CODE_TTL_SECONDS || 600),
  maxCodeAttempts: 5,
  maxResends: 3
};

const MESSAGES = {
  invalid: 'Invalid email or password.',
  locked: 'Too many failed attempts. We sent a verification code to your email.',
  codeRequired: 'Your account is locked. Enter the verification code we sent to your email.',
  wrongCode: 'Incorrect verification code.',
  expiredCode: 'This code has expired. Request a new code.',
  tooManyCodes: 'Too many incorrect codes. Request a new code.',
  resent: 'If the account is locked, a new code has been sent.',
  resendLimit: 'You have requested too many codes. Contact support.'
};

// Test-support endpoints (creating users, expiring a code) exist only outside production.
const testSupportEnabled = process.env.NODE_ENV !== 'production' && process.env.ENABLE_TEST_SUPPORT !== 'false';

const users = new Map();     // email -> user record
const sessions = new Map();  // session token -> email

const normalize = email => String(email || '').trim().toLowerCase();
const hash = (value, salt) => crypto.scryptSync(String(value), salt, 32).toString('hex');
const same = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

function createUser(email, password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const user = { email: normalize(email), salt, passwordHash: hash(password, salt), failedAttempts: 0, locked: false, code: null, resends: 0 };
  users.set(user.email, user);
  return user;
}

// One fictional user for trying the feature by hand.
createUser('demo@bioguard.test', 'Demo#2026');

async function issueCode(user) {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  user.code = {
    hash: hash(code, user.salt),
    expiresAt: Date.now() + RULES.codeLifetimeSeconds * 1000,
    attempts: 0,
    used: false
  };
  const minutes = Math.round(RULES.codeLifetimeSeconds / 60);
  await sendEmail({
    to: user.email,
    subject: 'Your BioGuard AI verification code',
    text: `Your BioGuard AI verification code is ${code}.\n\nIt expires in ${minutes} minutes and can be used once.\n\nIf you did not try to sign in, someone may be trying to access your account.\n\nBioGuard AI is a fictional demo application.`
  });
}

function startSession(res, email) {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, email);
  // Lax is the usual setting for session cookies: sent on same-site navigations,
  // not on requests from other sites.
  res.setHeader('Set-Cookie', `bg_session=${token}; HttpOnly; SameSite=Lax; Path=/`);
}

function sessionEmail(req) {
  const token = /(?:^|;\s*)bg_session=([a-f0-9]+)/.exec(req.headers.cookie || '')?.[1];
  return token ? sessions.get(token) : undefined;
}

async function readJson(req) {
  let raw = '';
  for await (const part of req) {
    raw += part;
    if (raw.length > 10000) throw Object.assign(new Error('Payload too large'), { status: 413 });
  }
  try {
    return JSON.parse(raw || '{}');
  } catch {
    throw Object.assign(new Error('Invalid JSON'), { status: 400 });
  }
}

const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
};

async function login({ email, password }) {
  const user = users.get(normalize(email));
  // Unknown email: same answer as a wrong password, and no counter to reveal anything.
  if (!user) return [401, { status: 'invalid', message: MESSAGES.invalid }];

  if (user.locked) return [423, { status: 'code_required', message: MESSAGES.codeRequired }];

  if (same(hash(password, user.salt), user.passwordHash)) {
    user.failedAttempts = 0;
    return [200, { status: 'ok', email: user.email }];
  }

  user.failedAttempts += 1;
  if (user.failedAttempts > RULES.maxFailedAttempts) {
    user.locked = true;
    user.resends = 0;
    await issueCode(user);
    return [423, { status: 'code_required', message: MESSAGES.locked }];
  }
  return [401, { status: 'invalid', message: MESSAGES.invalid }];
}

function verify({ email, code }) {
  const user = users.get(normalize(email));
  if (!user || !user.locked || !user.code || user.code.used) return [400, { status: 'invalid_code', message: MESSAGES.wrongCode }];
  if (user.code.attempts >= RULES.maxCodeAttempts) return [400, { status: 'too_many_codes', message: MESSAGES.tooManyCodes }];
  if (Date.now() > user.code.expiresAt) return [400, { status: 'expired_code', message: MESSAGES.expiredCode }];

  if (!same(hash(String(code ?? '').trim(), user.salt), user.code.hash)) {
    user.code.attempts += 1;
    return user.code.attempts >= RULES.maxCodeAttempts
      ? [400, { status: 'too_many_codes', message: MESSAGES.tooManyCodes }]
      : [400, { status: 'invalid_code', message: MESSAGES.wrongCode }];
  }

  user.code.used = true;
  user.locked = false;
  user.failedAttempts = 0;
  return [200, { status: 'ok', email: user.email }];
}

async function resend({ email }) {
  const user = users.get(normalize(email));
  // Same answer whether or not the account exists or is locked.
  if (!user || !user.locked) return [202, { status: 'sent', message: MESSAGES.resent }];
  if (user.resends >= RULES.maxResends) return [429, { status: 'resend_limit', message: MESSAGES.resendLimit }];
  user.resends += 1;
  await issueCode(user);
  return [202, { status: 'sent', message: MESSAGES.resent }];
}

/** Handles the login pages and APIs. Returns true when it answered the request. */
export async function handleAuth(req, res, path) {
  try {
    if (req.method === 'GET' && path === '/login') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(LOGIN_HTML);
      return true;
    }
    if (req.method === 'GET' && path === '/account') {
      const email = sessionEmail(req);
      if (!email) {
        res.writeHead(302, { Location: '/login' });
        res.end();
        return true;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(accountHtml(email));
      return true;
    }
    if (req.method === 'POST' && (path === '/api/auth/login' || path === '/api/auth/verify')) {
      const body = await readJson(req);
      const [status, result] = path.endsWith('login') ? await login(body) : verify(body);
      if (status === 200) startSession(res, result.email);
      json(res, status, result);
      return true;
    }
    if (req.method === 'POST' && path === '/api/auth/resend') {
      const [status, result] = await resend(await readJson(req));
      json(res, status, result);
      return true;
    }
    if (req.method === 'POST' && path === '/api/auth/logout') {
      const token = /(?:^|;\s*)bg_session=([a-f0-9]+)/.exec(req.headers.cookie || '')?.[1];
      if (token) sessions.delete(token);
      res.setHeader('Set-Cookie', 'bg_session=; Max-Age=0; Path=/');
      json(res, 200, { status: 'logged_out' });
      return true;
    }

    // ---- Test support (test environments only) ----
    if (testSupportEnabled && req.method === 'POST' && path === '/api/test-support/users') {
      const { email, password } = await readJson(req);
      if (!email || !password) return json(res, 400, { error: 'email and password are required' }), true;
      const user = createUser(email, password);
      json(res, 201, { email: user.email });
      return true;
    }
    if (testSupportEnabled && req.method === 'POST' && path === '/api/test-support/expire-code') {
      const user = users.get(normalize((await readJson(req)).email));
      if (!user?.code) return json(res, 404, { error: 'No code for that user' }), true;
      user.code.expiresAt = Date.now() - 1000; // as if the code's lifetime had passed
      json(res, 200, { expired: true });
      return true;
    }
  } catch (error) {
    if (error.status) return json(res, error.status, { error: error.message }), true;
    console.error('Auth error:', error.message);
    json(res, 503, { error: 'The verification email could not be sent. Try again later.' });
    return true;
  }
  return false;
}

const STYLE = 'body{font:16px system-ui;background:#f3f7fb;color:#182a40;margin:0}header{background:#153451;color:white;padding:25px 7%}main{max-width:480px;margin:30px auto;background:white;border-radius:16px;padding:28px;box-shadow:0 4px 24px #d9e2ee}label{display:block;margin:14px 0 4px;font-weight:600}input{width:100%;box-sizing:border-box;padding:10px;border:1px solid #b9c6d6;border-radius:8px;font:inherit}button{margin-top:16px;background:#153451;color:white;border:0;border-radius:8px;padding:11px 18px;font:inherit;cursor:pointer}button.secondary{background:white;color:#153451;border:1px solid #153451;margin-left:8px}.msg{margin-top:16px;padding:12px;border-radius:8px}.error{background:#fde2e1;color:#7f1d1d}.info{background:#e7f1fb;color:#1d3f66}[hidden]{display:none}small{color:#5c6e81}';
const HEADER = '<header><h1>BioGuard AI</h1><div>Synthetic Biotech Sample Quality Engineering Demo</div></header>';

const LOGIN_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>BioGuard AI | Log in</title><style>${STYLE}</style></head><body>${HEADER}<main>
<h2>Log in</h2>
<form id="login-form" novalidate>
  <label for="email">Email</label><input id="email" name="email" type="email" autocomplete="username" required>
  <label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required>
  <button type="submit">Log in</button>
</form>
<form id="code-form" hidden novalidate>
  <label for="code">Verification code</label><input id="code" name="code" inputmode="numeric" autocomplete="one-time-code">
  <button type="submit">Verify</button><button type="button" class="secondary" id="resend">Resend code</button>
</form>
<div id="message" class="msg" role="alert" hidden></div>
<p><small>Fictional demo accounts only. Try demo@bioguard.test / Demo#2026.</small></p>
</main><script>
const $ = s => document.querySelector(s);
const show = (text, kind) => { const m = $('#message'); m.textContent = text; m.className = 'msg ' + kind; m.hidden = false; };
const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(async r => ({ status: r.status, body: await r.json() }));
const email = () => $('#email').value;
$('#login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const r = await post('/api/auth/login', { email: email(), password: $('#password').value });
  if (r.status === 200) return location.assign('/account');
  if (r.body.status === 'code_required') { $('#code-form').hidden = false; return show(r.body.message, 'info'); }
  show(r.body.message || r.body.error, 'error');
});
$('#code-form').addEventListener('submit', async e => {
  e.preventDefault();
  const r = await post('/api/auth/verify', { email: email(), code: $('#code').value });
  if (r.status === 200) return location.assign('/account');
  show(r.body.message || r.body.error, 'error');
});
$('#resend').addEventListener('click', async () => {
  const r = await post('/api/auth/resend', { email: email() });
  show(r.body.message || r.body.error, r.status === 202 ? 'info' : 'error');
});
</script></body></html>`;

const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const accountHtml = email => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>BioGuard AI | Account</title><style>${STYLE}</style></head><body>${HEADER}<main>
<h2>Account</h2><p>Signed in as <strong id="signed-in-email">${escapeHtml(email)}</strong></p>
<button id="logout">Log out</button>
</main><script>document.querySelector('#logout').addEventListener('click', () => fetch('/api/auth/logout', { method: 'POST' }).then(() => location.assign('/login')));</script></body></html>`;
