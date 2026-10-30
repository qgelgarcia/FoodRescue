# FoodRescue remaining implementation plan

Prepared: 29 October 2026. Updated status: source implementation complete and all four feature migrations deployed to linked Supabase on 30 October after the user's later authorization. Hosting publication and physical-device acceptance remain pending. See Deployment_2026-10-30.md and Defense_Test_Record.md for evidence.

## Scope and baseline

Deliver the agreed Android donor/claimant app and desktop web admin against shared Supabase. Follow Design_Agreement_FoodRescue.md. The October 19 implementation report is historical: the October 22 migration and Claim_Workflow_Setup.md supersede its missing donor decisions, claim cancellation and verified pickup findings.

Preserve existing authentication, atomic reservation, donor decisions, cancellation approval, first-claim edit locks, QR/manual verification, moderation, reports and audit logs. Extend their operations rather than introducing a second lifecycle.

SMS, background tracking, permanent bans, broadcasts and advanced analytics remain deferred. Dates and effort estimates depend on team availability and the defense date.

## 0. Confirm the baseline and contracts

- Run existing tests and production build; record failures before changes.
- Reconcile shared types and actual SQL operations. Document post/claim states, cancellation, notification events, journey access and terminal effects in Service_Contracts_FoodRescue.md.
- Check migration/deployment state using read-only inspection before planning any database application. Earlier setup documentation reports October 22 as applied; do not assume every environment matches it.
- Confirm available Android SDK/JDK/build tooling and the target Supabase environment early.

Acceptance: a reproducible baseline and an explicit operation/event contract; completed functionality is excluded from new implementation work.

## 1. Finish posting: pickup pins and durable photos

Primary areas: PostPage, MapPage, food service, validation helpers and Storage policies.

- Reuse the existing Leaflet map for manual donor pin selection. Persist validated latitude/longitude, required address and pickup instructions; remove fixed coordinates from live creation.
- Permit manual pin placement without GPS. Show the saved pin to claimants without requiring location permission.
- Upload one optional JPEG/PNG/WebP, maximum 5 MB, with owner-scoped Storage paths and server/storage enforcement. Persist a durable Storage reference rather than a browser blob URL.
- Show upload progress/failure and use the default image when absent. Clean up newly uploaded files if saving fails; preserve the existing photo if replacement fails.
- Keep all agreed listing details locked after any claim history, including through direct database writes.

Acceptance: a second account sees the exact saved pin, instructions and photo; missing photo succeeds; invalid uploads fail clearly; GPS denial permits posting; post-save failure does not leave an avoidable orphan upload.

## 2. Complete post closure and expiration

Primary areas: new SQL migration, post service/UI, shared types, existing lifecycle tests.

Source implementation for the database lifecycle is in `20261029020000_post_cancellation_and_expiration.sql`: `cancel_food_post` requires the owner and a reason, `expire_food_posts` closes due active and fully reserved listings, and pickup confirmation is persisted for the claimant. The cleanup job is registered every minute when `pg_cron` is available; server-side deadline checks remain authoritative between runs. Database regressions are in `scripts/claim-workflow.test.mjs`. Source changes are not evidence that the migration has been deployed.

- Add explained donor post cancellation, restricted to the owner. In one transaction close the post, reject pending claims, cancel accepted claims, obsolete outstanding cancellation requests, invalidate pickup passes and notify affected members. Preserve completed pickups.
- Reuse the established post-first locking order and prevent repeated cancellation from repeating effects. Cancelled/removed/expired posts cannot reopen through inventory release.
- Add idempotent expiration processing for active and fully reserved posts: reject pending claims and expire accepted claims, preserve history and invalidate outstanding authorization/requests.
- Schedule cleanup using the supported Supabase mechanism. Keep existing server-time checks authoritative between runs; no client clock grants pickup or claim eligibility.
- Expose cancellation reasons and accurate terminal states in member and admin views.

Acceptance: unauthorized cancellation fails; repeated cleanup is harmless; cancellation versus pickup and expiry versus pickup have one consistent outcome; completed history survives; deadline checks work while the scheduler is delayed.

## 3. Complete history, profile and shared updates

Primary areas: My Posts, ProfilePage, auth/profile service, notification service/header and feed refresh.

- Show all own listing states in history, with links to donor requests and the applicable closure explanation.
- Add profile editing for allowed personal fields with validation and owner authorization. Prevent role/status edits through this path.
- Remove hardcoded rescue offsets. Count verified picked-up portions for food redistribution metrics; label environmental conversions as estimates or omit unsupported conversions.
- Complete persisted notification coverage for the existing workflow and Phase 2 events, using transactional writes and duplicate-safe operations.
- Establish one refresh convention for notifications, discovery, maps and history: refresh after actions and on focus, with bounded visible-page polling initially. Add Realtime only if demonstrated latency requirements justify it.

Acceptance: changes appear in another session; unread state survives relogin; empty live feeds remain empty; released inventory reappears; metrics match verified records; users cannot edit other profiles or protected fields.

## 4. Add departure notices and foreground journey sharing

Primary areas: new journey migration/service, claim controls and donor map.

- Implement a server-validated, once-only On my way action for accepted, unexpired claims. Notify only the donor; repeated taps produce no duplicate notice.
- Request explicit consent separately for sharing location. Denied GPS must not block the departure notice or pickup.
- Store only the latest coordinates and timestamp per eligible claim. Restrict publishing to its claimant and reading to its donor; unrelated members and admins cannot read journey coordinates.
- Publish while the app is in the foreground. Show unavailable/stale location honestly; stop device watchers when hidden or leaving the sharing experience. Do not imply background updates.
- Provide manual stop without cancelling the claim. Delete coordinates on stop, pickup, effective cancellation, donor cancellation, admin removal and expiration.
- Integrate deletion into terminal SQL operations and scheduled cleanup. Serialize updates against closure so delayed requests cannot restore deleted coordinates.

Acceptance: two devices demonstrate consent, once-only departure, donor-only access, stale/denied GPS, manual stop and all terminal cleanup paths. A late location update cannot revive a closed journey.

## 5. Package Android and prepare web admin delivery

Primary areas: Capacitor/Android configuration, package scripts and release documentation.

- Add compatible Capacitor dependencies and the Android project; document environment variables, reproducible builds and installation.
- Configure the minimum camera/location permissions and verify existing scanner/manual fallback, Leaflet tiles, uploads, sessions and foreground lifecycle behavior inside the APK.
- Build an installable release candidate and deploy/verify the desktop web admin using the project's deployment configuration.
- Record build/version and actual device/Android versions. Do not claim camera or APK acceptance from browser checks alone.

Acceptance: two installed Android apps and a separate desktop admin session share the same backend and complete the main workflow.

## 6. Integrated acceptance and defense evidence

- Run npm test and npm run build, plus meaningful database tests for every new authorization, closure and journey rule.
- Verify concurrent reservation/release, wrong-donor verification, token replay, exact deadlines, post cancellation, cancellation approval/denial, suspension, removal, reports and audit entries.
- Run the full real-account walkthrough: post with photo/pin, reserve, accept, depart/share, donor verify and view history; separately exercise cancellation and expired pickup.
- Exercise offline/network failure, denied permissions and refresh after relogin. Record expected versus actual results and unresolved failures.
- Create Defense_Test_Record.md with device/build details and evidence; update the implementation status, rubric and walkthrough to match verified behavior.

Acceptance: APK, admin URL, setup instructions and demo script are ready; all required checks pass or a concrete blocker is recorded. Tests and deployment claims must identify their environment.

## Execution rules and dependencies

Sequence: baseline → posting → closure/expiration → history/profile/notifications → departure/journey → Android/web delivery → integrated acceptance.

Check Android tooling in Phase 0 to expose packaging blockers early. Journey implementation depends on the completed closure operations and notification contract. Physical Android checks can begin as soon as a usable package exists.

Deliver each coherent change as a small reviewable commit with its migration, client integration and relevant checks. Use additive migrations; do not rewrite deployed migrations. Keep existing claim SQL regression tests and extend them for changed behavior. Apply/deploy through the configured workflow only when authorized; this planning document itself does not apply migrations or publish a release.
