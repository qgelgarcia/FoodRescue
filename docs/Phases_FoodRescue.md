# FoodRescue — Development Phases

Revised build order for the confirmed [Design Agreement](Design_Agreement_FoodRescue.md). These are pending delivery milestones, not completed phases.

## 1. Shared data and authorization
Add target lifecycle/data changes, validated RPC operations, profile/status protection, participant history access, report visibility, and audited admin operations. Ensure server-time deadline checks and atomic reservation/release. Review existing grants, policies, and cascade deletes.

## 2. Posting, maps, and photos
Persist donor-selected map pins, address/instructions, future deadlines, and one optional validated Storage photo. Implement own-post management, first-claim edit lock, and explained cancellation. Replace prototype maps/hardcoded coordinates.

## 3. Shared claims and cancellation
Use canonical database claim IDs and statuses in both accounts. Implement donor accept/reject, explained donor-approved cancellation for pending/accepted claims, eligibility/retry rules, release-once and reopening, and persisted history. Remove local self-completion as a live path.

## 4. Verified pickup and deadlines
Implement opaque single-use QR with equivalent manual code fallback, donor-only full-quantity confirmation, terminal invalidation, and deadline cleanup. Verify claim/pickup/cancellation races and replay prevention.

## 5. Notifications and foreground journey sharing
Persist in-app notifications, optional once-only On my way, consented donor-only latest coordinates, stale/unavailable states, and deletion when sharing ends. Test GPS denial without blocking pickup. SMS work remains deferred.

## 6. Live admin and reporting
Implement shared user/post/claim views, suspension/reactivation preserving existing arrangements, explained post removal, open/reviewed/resolved reports with resolution explanations, own report status, and atomic audit entries.

## 7. Android APK and defense validation
Package the member app as an Android APK and deploy desktop web admin. Test on separate real accounts/devices. Verify camera, foreground tracking, uploads, denied permissions, concurrency, cancellation/reopening, cutoff, replay prevention, reports, and moderation logs. Record manual evidence and reconcile rubric claims.

## Deferred phase
SMS provider setup and Edge Functions for Philippine acceptance/departure notifications; fallback in-app without undoing actions. Background tracking, permanent bans, broadcasts, and advanced analytics remain deferred. Do not count these as implemented defense features.
