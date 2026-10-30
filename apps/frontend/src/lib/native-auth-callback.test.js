import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nativeAuthCode } from './native-auth-callback.js';
test('native auth handles only its exact callback and never accepts implicit token injection', () => {
  assert.equal(nativeAuthCode('https://example.org/?code=secret'), null);
  assert.equal(nativeAuthCode('org.foodrescue.campus://other/callback?code=secret'), null);
  assert.equal(nativeAuthCode('org.foodrescue.campus://auth/elsewhere?code=secret'), null);
  assert.deepEqual(nativeAuthCode('org.foodrescue.campus://auth/callback?code=example'), { code: 'example', failed: false });
  assert.deepEqual(nativeAuthCode('org.foodrescue.campus://auth/callback#access_token=untrusted'), { code: null, failed: false });
});
