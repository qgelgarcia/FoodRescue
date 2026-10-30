# FoodRescue — System Design

Target design confirmed in [Design Agreement](Design_Agreement_FoodRescue.md); not implementation evidence.

## Actors and modules
Students, organizations, and providers can be donors or claimants. Admins moderate through the desktop web panel. The Android APK contains auth, feed, live map, posting, donor claims, own claims/history, profile, and notification experiences.

## Shared operations
1. Posting uploads an optional validated photo to Storage, then persists the offering with a donor-selected pin, address, instructions, and deadline.
2. Claim submission validates identity, account status, non-ownership, per-person eligibility, deadline, and quantity; atomically reserves inventory and inserts a pending claim.
3. Donor acceptance/rejection updates the persisted claim and notifies the claimant. Rejection releases once and may reopen a fully reserved post.
4. Cancellation requests store an explanation separately from the claim lifecycle. Donor approval cancels and releases once; denial leaves the prior state intact.
5. On my way records one departure notice. Consented foreground location updates store only the latest point with its update time, readable only by the claim's donor.
6. QR scan or manual code submits pickup authorization to a server operation that validates donor ownership, accepted state, deadline, and single use, then atomically confirms the whole pickup.
7. Deadline processing rejects pending claims and expires accepted uncollected claims; all claim/pickup operations enforce the timestamp independently of the job.
8. Donor cancellation/admin removal closes the post and its outstanding claims, invalidates tokens, clears journey coordinates, and persists notifications. Admin removal also writes an audit entry in the same transaction.

## Consistency and access
Serialize inventory and claim lifecycle changes with database transactions. Concurrent pickup/cancellation/removal must not both succeed. Realtime/shared refresh reads canonical persisted state, not local claim passes. Feed reads require active status and a future deadline; claimants retain access to related closed-post details for history.

RLS restricts row visibility; server operations and restricted grants enforce fields, actor permissions, state transitions, and deadlines. Audit rows and notifications are written as part of relevant shared operations. Broad unrestricted admin CRUD must not bypass mandatory auditing.

## Notifications and SMS
Persist in-app notifications for decisions and closure events. SMS is deferred: eventual Edge Functions send acceptance to claimant and departure to donor for Philippine numbers. Provider/setup is unresolved; failures fall back in-app without undoing the action. No automatic SMS retry policy has been agreed.

## Implementation locations
Current client/data modules are JavaScript under apps/frontend/src/services; user components under apps/frontend/src/components; auth/admin under modules; guards under guards. Shared interfaces are in packages/shared/src/index.ts. SQL migrations are under supabase/migrations. Existing Express service is under apps/backend/src.

Future operation names and new module boundaries are implementation choices, not already available APIs. Consult Database_FoodRescue.md for required data-model changes.
