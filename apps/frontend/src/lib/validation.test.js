import assert from 'node:assert/strict';
import test from 'node:test';
import { validateClaimQuantity, validateFoodPostDraft } from './validation.js';

const validDraft = {
  foodName: 'Vegetable rice bowls',
  description: 'Prepared rice bowls with vegetables. Contains soy.',
  category: 'Meals',
  quantity: '12',
  pickupAddress: 'Student Union, counter 2',
  duration: { hours: 3, minutes: 0 },
  photos: ['data:image/png;base64,preview'],
};

test('accepts a complete food post draft and normalizes values', () => {
  const result = validateFoodPostDraft(validDraft);

  assert.equal(result.isValid, true);
  assert.deepEqual(result.errors, {});
  assert.equal(result.values.quantity, 12);
  assert.equal(result.values.foodName, 'Vegetable rice bowls');
});

test('rejects invalid food post fields', () => {
  const result = validateFoodPostDraft({
    ...validDraft,
    foodName: 'x',
    category: 'Invalid',
    quantity: '0',
    duration: { hours: 0, minutes: 5 },
    photos: [],
  });

  assert.equal(result.isValid, false);
  assert.ok(result.errors.foodName);
  assert.ok(result.errors.category);
  assert.ok(result.errors.quantity);
  assert.ok(result.errors.duration);
  assert.ok(result.errors.photos);
});

test('rejects a claim larger than the remaining quantity', () => {
  assert.equal(validateClaimQuantity({ quantity_remaining: 2 }, 3), 'That many portions are no longer available.');
  assert.equal(validateClaimQuantity({ quantity_remaining: 2 }, 0), 'Choose at least one portion.');
  assert.equal(validateClaimQuantity({ quantity_remaining: 2 }, 2), null);
});

import { validateAccount } from './validation.js';
import { friendlyError, fetchWithTimeout } from '../services/request.js';

test('account fields enforce format, length, confirmation and optional phone digits', () => {
  const valid = { email: 'student@campus.edu', password: 'Good-password1!', fullName: 'Alex Student', confirmPassword: 'Good-password1!', phone: '9171234567' };
  assert.deepEqual(validateAccount(valid, true), {});
  assert.deepEqual(validateAccount({ ...valid, phone: '' }, true), {});
  for (const [field, value] of Object.entries({ email: 'invalid', password: 'short', fullName: ' ', phone: '-------', confirmPassword: 'different', role: 'admin' })) {
    assert.ok(validateAccount({ ...valid, [field]: value }, true)[field]);
  }
  assert.ok(validateAccount({ ...valid, email: 'x'.repeat(250) + '@a.com' }, true).email);
  assert.ok(validateAccount({ ...valid, password: 'x'.repeat(129) }, true).password);
  assert.ok(validateAccount({ email: 'student@campus.edu', password: '' }).password);
});

test('service details never appear in public errors', () => {
  assert.match(friendlyError(new Error('database secret_table failed SQL')), /could not complete/);
  assert.match(friendlyError(new Error('Failed to fetch')), /connection/);
  assert.match(friendlyError(new Error('request timeout')), /longer than expected/);
});

test('timeout aborts the request and preserves successful responses', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (_input, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))));
    await assert.rejects(fetchWithTimeout('https://example.test', {}, 5), { name: 'AbortError' });
    globalThis.fetch = async () => new Response('{}');
    assert.equal((await fetchWithTimeout('https://example.test')).status, 200);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

import { PHONE_COUNTRIES, limitPhone, PASSWORD_REQUIREMENTS } from './account-inputs.js';

test('phone input limits digits and accepts national or international Philippine paste', () => {
  assert.equal(limitPhone('0917 123 4567', 'PH'), '9171234567');
  assert.equal(limitPhone('+63 917 123 4567', 'PH'), '9171234567');
  assert.equal(limitPhone('917123456789999', 'PH'), '9171234567');
  assert.equal(limitPhone('abc917xyz', 'PH'), '917');
  for (const country of PHONE_COUNTRIES) {
    assert.equal(limitPhone('9'.repeat(25), country.id).length, country.digits);
    assert.ok(country.pattern.test(country.template.replace(/\D/g, '')));
  }
});

test('password checklist matches signup validation while existing passwords can sign in', () => {
  const account = { email: 'a@campus.edu', fullName: 'Alex', password: 'Password1!', confirmPassword: 'Password1!' };
  assert.deepEqual(validateAccount(account, true), {});
  for (const password of ['short1!', 'Password!', 'PASSWORD1!', 'password1!', 'Password12']) {
    assert.ok(validateAccount({ ...account, password, confirmPassword: password }, true).password);
  }
  assert.ok(PASSWORD_REQUIREMENTS.every(rule => rule.regex.test(account.password)));
  assert.equal(validateAccount({ email: 'a@campus.edu', password: 'existing-password' }).password, undefined);
  assert.equal(validateAccount({ email: 'wrong' }).email, 'Enter a valid email address.');
  assert.ok(validateAccount({ ...account, phone: '8171234567' }, true).phone);
});
