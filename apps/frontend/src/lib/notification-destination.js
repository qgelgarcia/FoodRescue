const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function notificationDestination(item) {
  if (UUID.test(item?.related_report_id || '')) return {
    pathname: '/app/reports', state: { notificationReportId: item.related_report_id }, label: 'View report',
  };
  if (UUID.test(item?.related_claim_id || '')) return {
    pathname: '/app/history', state: { notificationClaimId: item.related_claim_id }, label: 'View pickup',
  };
  if (UUID.test(item?.related_post_id || '')) return {
    pathname: '/app/history', state: { notificationPostId: item.related_post_id }, label: 'View pickup history',
  };
  return null;
}

export function matchesNotificationClaim(claim, claimId, postId) {
  return claimId ? claim.id === claimId : Boolean(postId && claim.post_id === postId);
}
