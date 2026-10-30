import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesNotificationClaim, notificationDestination } from './notification-destination.js';

const claim = 'b3077e80-f66e-4ef4-b2aa-b03408e7e413';
const post = '2f424182-1c77-4dd3-920e-bc90fa8955ad';

test('exact report and claim references take precedence over the historical post fallback', () => {
  assert.deepEqual(notificationDestination({ related_report_id: claim, related_post_id: post }), {
    pathname: '/app/reports', state: { notificationReportId: claim }, label: 'View report',
  });
  assert.deepEqual(notificationDestination({ related_claim_id: claim, related_post_id: post }).state, { notificationClaimId: claim });
  assert.deepEqual(notificationDestination({ related_post_id: post }).state, { notificationPostId: post });
  assert.equal(notificationDestination({ message: `Open report ${claim}` }), null);
  assert.equal(notificationDestination({ related_claim_id: '/admin/dashboard' }), null);
});

test('an exact claim never falls back to another member claim on the same post', () => {
  const row = { id: claim, post_id: post };
  assert.equal(matchesNotificationClaim(row, claim, post), true);
  assert.equal(matchesNotificationClaim(row, post, post), false);
  assert.equal(matchesNotificationClaim(row, null, post), true);
  assert.equal(matchesNotificationClaim(row, null, null), false);
});
