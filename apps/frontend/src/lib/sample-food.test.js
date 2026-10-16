import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_POSTS } from '../services/sample-food.js';

test('sample feed has all categories and complete, clearly marked listings', () => {
  assert.equal(DEFAULT_POSTS.length, 6);
  assert.deepEqual(new Set(DEFAULT_POSTS.map(post => post.category)), new Set(['Meals', 'Produce', 'Bakery', 'Snacks']));
  assert.equal(new Set(DEFAULT_POSTS.map(post => post.id)).size, DEFAULT_POSTS.length);
  for (const post of DEFAULT_POSTS) {
    assert.equal(post.is_sample, true);
    assert.ok(post.food_name && post.description && post.pickup_address && post.donor.full_name);
    assert.ok(post.quantity_remaining > 0 && post.quantity_remaining <= post.quantity_total);
    assert.ok(Date.parse(post.expires_at) > Date.now());
    assert.equal(new URL(post.photo_url).protocol, 'https:');
  }
});
