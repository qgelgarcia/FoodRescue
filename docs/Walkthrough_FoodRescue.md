# FoodRescue — Walkthrough

Confirmed target defense journey. Consult Rubric_Audit.md for current gaps; this walkthrough is not proof the flow currently works.

## Member setup
Install the Android APK on two phones. Use separate real donor and claimant accounts; provision a separate admin account for desktop web use.

## Donor and claimant flow
1. Donor creates a post with positive portions, future pickup deadline, interactive map pin, address/instructions, and optional uploaded photo.
2. Claimant views the real offering and submits a quantity. Shared availability falls immediately; the claim is pending, not ready for pickup.
3. Donor accepts. Claimant sees accepted state and QR/manual pickup authorization.
4. Claimant optionally taps On my way once. Donor receives an in-app notice. With consent, donor sees the claimant's latest foreground location and last update time.
5. Denied GPS does not block On my way or pickup. Manual stop removes shared coordinates without cancelling the claim.
6. At pickup, donor scans QR or enters the fallback code. The server confirms the entire claim once before the deadline. Both histories reflect the pickup; coordinates are deleted.
7. A repeat scan cannot create another pickup; the claimant cannot claim again from this post after pickup.

## Cancellation and deadline demonstrations
- Request explained cancellation while pending or accepted; reservation stays held. Donor denial preserves the arrangement; approval cancels, invalidates authorization, and releases once.
- Release the last reservation on a fully reserved post before deadline and verify available portions reappear in the feed.
- Retry after rejection/cancellation while eligible; earlier claims remain in history.
- Demonstrate donor post cancellation with explanation: outstanding pickups close; completed pickups remain.
- At the exact deadline, stop new claims and pickup, reject pending claims, expire accepted uncollected claims, and clear journey coordinates. Scheduled job delay must not allow late pickup.
- Attempt an edit after the first claim and confirm locked details stay fixed.

## Admin and report demonstration
1. A signed-in non-admin reports a post or another member with an explanation and sees their own report status. Self-reporting is blocked.
2. Admin views real users, posts, and claims, then reviews the report.
3. Admin suspends a member: new posts/claims blocked, existing arrangements and reporting still allowed. Reactivation lifts restriction.
4. Admin removes a post with explanation: pending claims rejected, accepted claims cancelled, authorizations invalidated, and donor/claimants notified.
5. Admin resolves the report with explanation. Reports and every moderation change remain visible in persisted history/audit logs.

## Required evidence
Record APK/device results for camera, map, location permissions/staleness, photo upload, and separate-account shared state. Check concurrency, cutoff, repeated scans/releases, cancellation decisions, reports, and audit entries.

SMS integration is deferred. Intended later events are acceptance-to-claimant and departure-to-donor for Philippine numbers, with in-app fallback on sending failure. Do not show simulated SMS as actual delivery. Background tracking, bans, broadcasts, and advanced analytics are outside the current agreed delivery.
