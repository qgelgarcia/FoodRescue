import { test } from 'node:test';
import assert from 'node:assert/strict';
import { profileFields, verifiedPortions } from './profile-inputs.js';

test('profile update accepts personal fields only and validates optional international phone', () => {
  assert.deepEqual(profileFields({ fullName: '  Campus Member ', phone: '', role: 'admin' }), { full_name: 'Campus Member', phone: null });
  assert.throws(() => profileFields({ fullName: 'A', phone: '' }));
  assert.throws(() => profileFields({ fullName: 'Member', phone: 'abc' }));
  assert.equal(profileFields({ fullName: 'Member', phone: '+639171234567' }).phone, '+639171234567');
});

test('rescue count sums verified portions and excludes demos and uncollected claims', () => {
  assert.equal(verifiedPortions([{ status: 'picked_up', quantity: 4 }, { status: 'picked_up', quantity_claimed: 2 }, { status: 'picked_up', quantity: 20, is_sample: true }, { status: 'accepted', quantity: 8 }]), 6);
});
