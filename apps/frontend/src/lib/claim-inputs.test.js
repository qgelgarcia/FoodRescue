import assert from 'node:assert/strict';
import test from 'node:test';
import { cancellationReason, claimId, claimRequestError, pickupCode } from './claim-inputs.js';
import { friendlyError } from '../services/request.js';

test('pickup entry accepts only the opaque token and normalizes manual typing', () => {
  const code = 'a67ae3d2-e10e-4f63-a9d9-62815cba7604';
  assert.equal(pickupCode(` ${code.toUpperCase()} `), code);
  assert.equal(claimId(code), code);
  for (const bad of ['', 'FR-1234', `https://example.com/${code}`, JSON.stringify({ token: code })]) {
    assert.throws(() => pickupCode(bad));
  }
  assert.throws(() => claimId('sample-claim'));
});

test('cancellation requires an actual explanation and retains its text', () => {
  assert.equal(cancellationReason('  I cannot reach the pickup point.  '), 'I cannot reach the pickup point.');
  for (const reason of ['', '         ', 'Too short', 'x'.repeat(2001)]) assert.throws(() => cancellationReason(reason));
});

test('workflow failures explain safe recovery without revealing service internals', () => {
  assert.match(friendlyError(claimRequestError({ message: 'Pickup pass is invalid or expired' })), /invalid or has already been used/);
  assert.match(friendlyError(claimRequestError({ message: 'The pickup deadline has passed' })), /deadline has passed/);
  assert.match(friendlyError(claimRequestError({ message: 'Pickup cannot be confirmed while a cancellation request awaits a decision' })), /pending cancellation/);
  assert.match(friendlyError(claimRequestError({ message: 'Only the listing donor can confirm this pickup' })), /Only this listing’s donor/);
  assert.match(friendlyError(claimRequestError({ code: 'PGRST202', message: 'internal function schema details' })), /database update/);
  assert.match(friendlyError(claimRequestError({ message: 'secret_schema internal database stack trace' })), /could not complete/);
});
