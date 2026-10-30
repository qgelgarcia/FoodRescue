import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nativeAuthCallback, nativeAuthCode, nativeAuthDestination } from './native-auth-callback.js';
test('native auth handles only its exact callback and never accepts implicit token injection', () => {
  assert.equal(nativeAuthCode('https://example.org/?code=secret'), null);
  assert.equal(nativeAuthCode('org.foodrescue.campus://other/callback?code=secret'), null);
  assert.equal(nativeAuthCode('org.foodrescue.campus://auth/elsewhere?code=secret'), null);
  assert.deepEqual(nativeAuthCode('org.foodrescue.campus://auth/callback?code=example'), { code: 'example', failed: false });
  assert.deepEqual(nativeAuthCode('org.foodrescue.campus://auth/callback#access_token=untrusted'), { code: null, failed: true });
});

test('native recovery callback is a separate exact intent and never navigates to the feed', () => {
  assert.equal(nativeAuthCallback('org.foodrescue.campus://auth/elsewhere?code=example'), null);
  const callback = nativeAuthCallback('org.foodrescue.campus://auth/recovery?code=one-time-code');
  assert.deepEqual(callback, { kind: 'recovery', code: 'one-time-code', failed: false, error: null });
  assert.equal(nativeAuthDestination(callback, true), '/reset-password');
  assert.equal(nativeAuthDestination(callback, false), '/reset-password?recovery_error=invalid');

  const expired = nativeAuthCallback('org.foodrescue.campus://auth/recovery?error=access_denied&error_code=otp_expired');
  assert.deepEqual(expired, { kind: 'recovery', code: null, failed: true, error: 'expired' });
  assert.equal(nativeAuthDestination(expired, false), '/reset-password?recovery_error=expired');

  const login = nativeAuthCallback('org.foodrescue.campus://auth/callback?code=oauth-code');
  assert.equal(nativeAuthDestination(login, true), '/login');
  assert.equal(nativeAuthDestination(login, false), '/login?auth_error=1');
});
