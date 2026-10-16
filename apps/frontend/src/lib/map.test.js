import test from 'node:test';
import assert from 'node:assert/strict';
import { hasPickupCoordinates, availableMapPosts } from './map.js';

test('map accepts only valid numeric coordinates, including zero', () => {
  assert.equal(hasPickupCoordinates({ pickup_lat: 0, pickup_lng: 0 }), true);
  for (const post of [{}, { pickup_lat: null, pickup_lng: 1 }, { pickup_lat: '14', pickup_lng: 120 }, { pickup_lat: 91, pickup_lng: 120 }, { pickup_lat: 14, pickup_lng: Infinity }]) assert.equal(hasPickupCoordinates(post), false);
});
test('map shows only active, unexpired listings with portions left', () => {
  const valid = { status: 'active', quantity_remaining: 2, expires_at: '2030-01-02' };
  assert.equal(availableMapPosts([valid, { ...valid, status: 'cancelled' }, { ...valid, quantity_remaining: 0 }, { ...valid, expires_at: '2020-01-01' }], Date.parse('2030-01-01')).length, 1);
});
