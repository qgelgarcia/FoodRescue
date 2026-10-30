# FoodRescue — Five-member task allocation

Based on the confirmed [design agreement](Design_Agreement_FoodRescue.md). Replace Member 1–5 with teammate names. These are pending assignments, not completed work. Task IDs can be copied into a team board; check them off only after their acceptance checks pass.

## Assignment overview

| Member | Work package | Primary deliverable |
|---|---|---|
| 1 | Shared foundation, auth, inventory and claim rules | Secure transactional core and agreed service contracts |
| 2 | Posting, discovery, pickup map and photo uploads | Real donor posting and claimant browsing |
| 3 | Claim screens, cancellation and QR pickup | Complete member reservation-to-pickup experience |
| 4 | Notifications, journey sharing and Android release | Shared updates, foreground tracking and working APK |
| 5 | Admin moderation, reports and audit | Live desktop administration and report-to-action workflow |

Every member owns tests and demo evidence for their package. Member 4 coordinates release, not all testing. Member 1 coordinates shared schema, not every member's database implementation.

## Member 1 — Foundation, auth and claim core

Primary files: supabase/migrations/, packages/shared/src/index.ts, apps/frontend/src/services/auth.js, apps/frontend/src/services/supabase.js, and auth guards. Coordinate migrations from other members rather than editing their work silently.

- [ ] M1-01 Define shared post/claim states, cancellation-request model, field names, operation inputs/outputs, error codes, and event payloads. Publish them in docs/Service_Contracts_FoodRescue.md before client integration. Return canonical claim IDs, never local pass IDs.
- [ ] M1-02 Implement schema changes and authorization for profiles, posts, claims, cancellation requests, participant history access, and status/role protection. Review destructive cascades against retained history.
- [ ] M1-03 Implement atomic claim submission: authenticated active member, not own post, positive quantity, future deadline, sufficient inventory, one pending/accepted claim per person/post, and no repeat after pickup.
- [ ] M1-04 Implement donor acceptance/rejection and explained cancellation requests/decisions. Denial preserves prior state; approval releases once. Reopen fully reserved posts when eligible.
- [ ] M1-05 Implement first-claim edit lock and explained donor post cancellation. Reject pending claims, cancel accepted claims, preserve pickups, and invoke agreed token/location cleanup and notification effects.
- [ ] M1-06 Implement expiration processing for active and fully reserved posts; pending claims reject, accepted claims expire. Ensure operations check server time independently of scheduled processing.
- [ ] M1-07 Supply reusable transaction conventions for release, token invalidation, journey deletion, and notification writes to Members 3–5. Wire terminal cleanup after their schemas land.

Acceptance: simultaneous requests cannot oversell; repeated release cannot inflate inventory; non-owner/unauthorized writes fail; deadline checks work between cleanup runs; suspended members cannot submit new claims/posts but can log in and complete existing arrangements. Demonstrate two real accounts, not local demo storage.

Handoff: contract/schema first to all members; claim/cancellation operations to Member 3; closure hooks to Members 3–5. Depends on Member 4's notification/location structures and Member 3's token structure for final terminal-cleanup integration.

## Member 2 — Posting, feed, map and uploads

Primary files: PostPage.jsx, HomeFeed.jsx, MapPage.jsx, and new post/map service modules under apps/frontend/src/services/. Member 2 owns FoodCard's food-detail display; Member 3 owns its claim interaction. Agree the callback interface before either edits it.

- [ ] M2-01 Implement donor-selected interactive pickup pins, required address/instructions, and claimant pin viewing. Remove CSS-only map and hardcoded coordinates as the live path.
- [ ] M2-02 Upload one optional JPEG/PNG/WebP up to 5 MB to Supabase Storage. Own the Storage policy/config migration, owner checks, useful failure feedback, default image, and handling uploads when post creation fails.
- [ ] M2-03 Connect create/edit/cancel post controls to validated shared operations. Show first-claim edit locks; collect required donor cancellation explanation.
- [ ] M2-04 Implement real available-post discovery with deadline filtering, countdowns, loading/error/empty states and shared refresh. Do not replace empty/error live results with mock posts.
- [ ] M2-05 Implement My Posts listing with canonical quantities/states and links into Member 3's donor claim-management screens. Display closed posts in own history where appropriate.
- [ ] M2-06 Verify location permission denial still permits manual pin selection and pickup viewing; verify actual uploads and live maps on the APK with Member 4.

Acceptance: a real post and photo created on one account appear on another; persisted pin matches selection; absent photo uses default; invalid/oversized uploads fail helpfully; locked details cannot be changed after the first claim; fully reserved/expired/closed posts are absent from discovery and eligible reopened posts return.

Handoff: post/map components and stored photo URLs to Members 3–4. Depends on Member 1's schema/operations and Member 4's shared-refresh conventions. Choose the map provider with Member 4 to avoid two separate map integrations.

## Member 3 — Claim UI, cancellation and pickup verification

Primary files: HistoryPage.jsx, claim controls in FoodCard.jsx, pickup controls in CustomerHeader.jsx, and new claim/pickup screens/services. Own pickup-authorization migration and server verification operation in coordination with Member 1.

- [ ] M3-01 Replace local ready_for_pickup passes and local completion with canonical shared pending/accepted/terminal claims. Coordinate refactoring food.js with Members 1–2; separate services before simultaneous edits.
- [ ] M3-02 Implement claimant My Claims/history and donor accept/reject controls. Show whole-quantity reservation and clear friendly concurrency errors.
- [ ] M3-03 Implement explanation-required cancellation requests for pending and accepted claims, donor approval/denial, and visible decision history. Do not free portions merely on requesting cancellation.
- [ ] M3-04 Implement opaque single-use pickup authorization, claimant QR display and manual code fallback. Both methods consume the same authorization; avoid exposing personal/food details in the QR.
- [ ] M3-05 Implement donor scanning/manual verification and server-side ownership, accepted-state, open-post, deadline and single-use checks. Confirm full quantity only; serialize against cancellation/removal.
- [ ] M3-06 Provide token invalidation to donor cancellation, approval of cancellation, admin removal, and expiration operations. Ensure completed pickups remain in history and counts derive from verified pickup.
- [ ] M3-07 Integrate the once-only On my way control supplied by Member 4 and route to pickup/map views. Verify Android scanner permission and manual fallback with Member 4.

Acceptance: donor acceptance is required; claimant cannot self-confirm; wrong donor, expired claim, cancelled claim and reused QR/code fail; manual success makes the QR unusable and vice versa; simultaneous cancellation/pickup cannot both succeed. History is visible across sessions/devices and does not use localStorage as its source of truth.

Handoff: verification/cleanup contract to Members 1 and 5; departure control integration to Member 4. Depends on claim operations from Member 1 and map/pickup details from Member 2.

## Member 4 — Notifications, journey tracking and APK

Primary files: new notification/location services and screens, journey map integration coordinated with Member 2, App.jsx integration, Android/Capacitor configuration and release documentation.

- [ ] M4-01 Implement persisted in-app notification inbox/read state and shared refresh/subscriptions. Supply transactional notification-write contracts to Members 1, 3 and 5; browser events alone do not prove multi-account delivery.
- [ ] M4-02 Implement optional On my way once per accepted unexpired claim; repeat taps create no duplicate notice. Share its component/API with Member 3.
- [ ] M4-03 Implement explicit location consent, foreground latest-coordinate publishing, donor-only access, and last-updated/unavailable states. GPS denial must not block the departure notice or pickup.
- [ ] M4-04 Implement manual stop and terminal cleanup: delete latest coordinates on stop, pickup, effective cancellation, removal or expiration; no route history. Validate eligibility server-side and coordinate scheduled cleanup with Member 1.
- [ ] M4-05 Configure/build Android APK and document installation, camera/location permissions, environment setup and reproducible build steps. Coordinate shared dependencies and package-lock changes.
- [ ] M4-06 Run integrated two-phone tests and collect device/version/build evidence from all members. Assemble final APK and defense test record; each member must resolve failures in their own package.
- [ ] M4-07 Keep intended Philippine SMS acceptance/departure events documented as deferred. Do not implement a provider, purchase credits, or demonstrate simulated delivery as real SMS in this work package.

Acceptance: donor sees notice/location from a different device; unrelated users/admins cannot read private journey coordinates; denied/stale GPS is honestly shown; sharing ends and coordinates disappear on every agreed closure; notifications survive relogin; APK installs and camera/upload/location paths work. Background tracking is not required.

Handoff: notification and journey schema/contracts early to Members 1, 3 and 5; APK test instructions to everyone. Depends on Member 1's eligibility rules, Member 2's map integration and Member 3's pickup/closure flow.

## Member 5 — Live admin, reports and audit

Primary files: apps/frontend/src/modules/admin/, new moderation/report services and member report screens. Own moderation/report/audit migrations and validated operations, coordinated with Member 1.

- [ ] M5-01 Replace simulated users/posts/claims with real authorized views. Use only necessary profile fields; do not expose journey coordinates to admins.
- [ ] M5-02 Implement suspend/reactivate server operations and UI. Suspension blocks new posting/claiming while preserving existing arrangements and reporting.
- [ ] M5-03 Implement explained admin removal using shared closure conventions: reject pending, cancel accepted, invalidate authorizations, delete journey coordinates, notify donor/claimants and preserve completed pickups.
- [ ] M5-04 Implement report submission for any signed-in non-admin including suspended members. Require explanation, block self-reporting, permit own report-status viewing, and retain reports.
- [ ] M5-05 Implement open → reviewed → resolved admin flow with required resolution explanation.
- [ ] M5-06 Write every moderation change and its actor/action/target/timestamp to the audit log in the same transaction as the change. Add the real audit-log screen; prevent silent direct-write bypasses.
- [ ] M5-07 Verify admin routes and server operations reject non-admins. Provide desktop deployment and admin provisioning instructions and a complete report-to-action demo.

Acceptance: non-admin cannot moderate; suspended member can report and finish existing pickups but cannot start new posts/claims; removal blocks existing QR/code; completed history survives; reporters see only their own reports; all moderation changes have matching audit entries. No permanent bans, broadcast or advanced analytics required.

Handoff: suspension contract to Members 1–3, closure integration to Members 1/3/4, and member report links to Member 3. Depends on shared lifecycle, token cleanup and notification contracts.

## Coordination and integration order

1. Foundation meeting: assign names; Member 1 publishes states/contracts, Members 3–5 publish their token/notification/location/moderation additions. Agree routes, event payloads, migration order, map integration and shared-file ownership.
2. Parallel work: each member builds owned screens and migrations against the agreed contracts. UI can use clearly labelled development fixtures until shared operations are ready; fixtures cannot satisfy acceptance.
3. First integration: Member 1 foundation → Member 2 real post → Member 3 reserve/accept/cancel. Members 4–5 can implement notification/admin shells while their contracts are integrated.
4. Full integration: QR/manual pickup, notifications, tracking, deadline cleanup, admin removal and reports. Member 1 reviews terminal effects with Members 3–5.
5. Release: each member submits evidence for their checks; Member 4 packages APK, Member 5 verifies deployed web admin, and the whole team rehearses the walkthrough.

Use one branch per package, such as codex/team-foundation or codex/team-posting. Coordinate migration timestamps and merge migrations in dependency order. App.jsx, styles.css, package.json/package-lock.json and food.js are shared hotspots: assign an editor for each integration change instead of simultaneous competing edits. Member 4 coordinates routing/package changes; Member 1 coordinates shared types/schema; component owners coordinate CSS additions.

## Team completion checklist

- [ ] Run npm test and npm run build after integration. Existing npm test covers validation helpers, not the database rules or Android workflows.
- [ ] Run meaningful database authorization, inventory and lifecycle concurrency checks for the changed operations.
- [ ] Demonstrate separate real donor/claimant accounts on two installed APKs and a separate desktop admin session.
- [ ] Complete the target walkthrough, including cancellation/reopening, exact deadline, token replay, denied permissions, suspension, removal and report resolution.
- [ ] Record build version, device details, results and screenshots in docs/Defense_Test_Record.md; record failures honestly.
- [ ] Update Rubric_Audit.md and Professor_Code_Walkthrough.md based on actual implementation/evidence. Each member explains their own UI, service and server rules.
- [ ] Deliver APK, desktop admin URL, setup/run instructions and demo script. Keep SMS and other deferred features labelled accurately.

No deadlines or effort estimates are imposed here because the team availability and defense date have not been supplied.
