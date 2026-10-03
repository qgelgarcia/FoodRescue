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
