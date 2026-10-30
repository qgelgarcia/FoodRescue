import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRecoverySessionTracker,
  isPasswordRecoveryRedirect,
  passwordRecoveryRedirect,
  recoveryLinkError,
  requestPasswordRecovery,
  saveRecoveredPassword,
  validateRecoveredPassword,
} from './password-recovery.js';

function authSession(userId, sessionId, issuedAt = 1) {
  const payload = btoa(JSON.stringify({ sub: userId, session_id: sessionId, iat: issuedAt }))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return { user: { id: userId }, access_token: `header.${payload}.signature` };
}

test('recovery redirects use the exact web route or the dedicated native URI', () => {
  assert.equal(passwordRecoveryRedirect({ origin: 'https://food.example/' }), 'https://food.example/reset-password');
  assert.equal(passwordRecoveryRedirect({ native: true, origin: 'https://ignored.example' }), 'org.foodrescue.campus://auth/recovery');
});

test('request uses a normalized email and returns the same non-disclosing success for absent accounts', async () => {
  let request;
  const result = await requestPasswordRecovery({
    email: '  STUDENT@Campus.edu ',
    redirectTo: 'https://food.example/reset-password',
    auth: { resetPasswordForEmail: async (...args) => { request = args; return { data: {}, error: null }; } },
  });
  assert.deepEqual(request, ['student@campus.edu', { redirectTo: 'https://food.example/reset-password' }]);
  assert.deepEqual(result, { error: null });
});

test('request failures distinguish throttling and network errors without claiming delivery', async () => {
  const throttled = await requestPasswordRecovery({ auth: { resetPasswordForEmail: async () => ({ error: { status: 429 } }) }, email: 'a@b.co', redirectTo: '/reset-password' });
  const offline = await requestPasswordRecovery({ auth: { resetPasswordForEmail: async () => { throw new Error('Failed to fetch'); } }, email: 'a@b.co', redirectTo: '/reset-password' });
  assert.match(throttled.error, /Too many recovery requests/);
  assert.match(offline.error, /couldn't reach.*connection/i);
});

test('recovered password follows existing composition, length, and confirmation rules', () => {
  assert.equal(validateRecoveredPassword('', ''), 'Please enter a new password.');
  assert.match(validateRecoveredPassword('short', 'short'), /password requirements/i);
  assert.match(validateRecoveredPassword('Goodpass1!', 'Otherpass1!'), /do not match/i);
  assert.match(validateRecoveredPassword(`Goodpass1!${'x'.repeat(120)}`, `Goodpass1!${'x'.repeat(120)}`), /128 characters/);
  assert.equal(validateRecoveredPassword('Goodpass1!', 'Goodpass1!'), null);
});

test('password update requires the recovery session and updates through the mocked auth service', async () => {
  let updated = false;
  const auth = { updateUser: async () => { updated = true; return { data: {}, error: null }; } };
  const denied = await saveRecoveredPassword({ auth, password: 'Goodpass1!', confirmation: 'Goodpass1!', hasRecoverySession: async () => false });
  assert.equal(denied.reason, 'invalid_link');
  assert.equal(updated, false);

  const saved = await saveRecoveredPassword({ auth, password: 'Goodpass1!', confirmation: 'Goodpass1!', hasRecoverySession: async () => true });
  assert.deepEqual(saved, { error: null });
  assert.equal(updated, true);
});

test('recovery authorization survives a passive same-session SIGNED_IN and clears for a replacement session', () => {
  const tracker = createRecoverySessionTracker();
  const recovery = authSession('user-1', 'session-recovery');
  tracker.observe('PASSWORD_RECOVERY', recovery);
  assert.equal(tracker.matches(recovery), true);

  // A refreshed JWT can have a new iat/access token while retaining the same session_id.
  const sameSession = authSession('user-1', 'session-recovery', 2);
  tracker.observe('SIGNED_IN', sameSession);
  assert.equal(tracker.matches(sameSession), true);

  // An explicit sign-in by the same user creates a different session_id.
  const explicitLogin = authSession('user-1', 'session-login');
  tracker.observe('SIGNED_IN', explicitLogin);
  assert.equal(tracker.matches(explicitLogin), false);

  tracker.observe('PASSWORD_RECOVERY', recovery);
  tracker.observe('SIGNED_OUT', null);
  assert.equal(tracker.matches(recovery), false);
});

test('a replayed or expired recovery session becomes a link error state', async () => {
  const result = await saveRecoveredPassword({
    auth: { updateUser: async () => ({ error: { message: 'Auth session missing!' } }) },
    password: 'Goodpass1!',
    confirmation: 'Goodpass1!',
    hasRecoverySession: async () => true,
  });
  assert.equal(result.reason, 'invalid_link');
  assert.match(result.error, /expired|already been used/i);
});

test('reset links expose only safe expired/invalid states', () => {
  assert.equal(recoveryLinkError('https://food.example/reset-password#access_token=secret&type=recovery&error=access_denied&error_code=otp_expired'), 'expired');
  assert.equal(recoveryLinkError('org.foodrescue.campus://auth/recovery?recovery_error=expired'), 'expired');
  assert.equal(recoveryLinkError('https://food.example/reset-password#type=recovery&error=access_denied'), 'invalid');
  assert.equal(recoveryLinkError('https://food.example/reset-password#access_token=secret&type=recovery'), null);
  assert.equal(isPasswordRecoveryRedirect('https://food.example/reset-password#access_token=secret&type=recovery'), true);
  assert.equal(isPasswordRecoveryRedirect('https://food.example/login#access_token=secret&type=signup'), false);
});
