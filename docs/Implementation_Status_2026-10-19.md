# Planned versus implemented — 19 October 2026

Baseline: the October 13 Design Agreement, Team Tasks, Specs, Phases, and ADRs. Inspected current `main` at `1537ce9`, including existing local planning-document edits. This describes source implementation, not proof that migrations were applied to the shared Supabase project or that separate real accounts/devices pass acceptance.

## Main finding

The browser app, authentication, basic posting/discovery, interactive map, database-backed claimant history, and most of the admin/reporting package exist. The agreed donor-approval-to-verified-pickup lifecycle is incomplete. The current claimant can complete a pending pickup themselves; a database token does not make this donor verification.

## What is implemented in source

- Supabase registration/sign-in/sign-out, session/profile retrieval, member/admin route guards, and server protection of role/status changes: `apps/frontend/src/services/auth.js`, `apps/frontend/src/guards/`, and the October 19 moderation migration.
- Create/read/edit/archive own active food listings: `apps/frontend/src/services/food.js:53`, `:110`, `:135`, `:172`; controls in `modules/post/PostPage.jsx`. Archive is narrower than the agreed explained cancellation workflow.
- Atomic quantity reservation and canonical claim IDs: `claim_food` in `supabase/migrations/20261019000000_member5_admin_moderation_reports.sql:180`. It checks authenticated identity, active membership, positive quantity and available inventory. Several agreed eligibility/deadline checks are still absent.
- Shared claimant history and server-backed completion: `food.js:272` and `:285`. This improves on the earlier local-only prototype, but completion semantics remain wrong for the plan.
- Real interactive Leaflet/OpenStreetMap browsing with persisted post coordinates, markers, tile errors, location permission feedback, and optional local position/radius display: `modules/map/MapPage.jsx:1`. This is not donor pin selection or sharing a claimant's journey with a donor.
- Admin users/posts/claims, database dashboard counts, suspend/reactivate, explained removal, reports and audit tools: `services/admin.js`, `modules/admin/AdminDashboard.jsx`, October 19/20 migrations.
- Member reporting and own report history: `services/reports.js`, `modules/reports/ReportsPage.jsx`; report RPCs enforce identity, target checks and explanations.
- Deployment caveat: `docs/Member5_Admin_Moderation.md:64` explicitly records that the moderation migration was not applied to remote Supabase during that implementation session. This review did not verify whether someone applied it afterward.
- Persisted notification reads and mark-read UI: `services/notifications.js`, `components/layout/CustomerHeader.jsx:35`; moderation operations write notification rows.
- Form/map/theme validation tests, conflict-marker checks and CI build gate: `apps/frontend/src/lib/*.test.js`, `scripts/`, `.github/workflows/ci.yml`.

## Team task comparison

Statuses: **Implemented** means the principal source paths exist; **Partial** means meaningful code exists but does not meet the full task; **Missing** means no complete source path was found; **Unverified** means acceptance requires deployment/device evidence. No status here certifies live deployment.

| Task | Status | Comparison with the plan |
|---|---|---|
| M1-01 Shared contracts/states | Partial | Canonical IDs exist, but shared types lack expired claims/cancellation requests; the planned Service Contracts document is absent. |
| M1-02 Schema/auth/history | Partial | Auth, RLS, protected roles/status and claimant history exist; target cancellation/journey/expired models and complete history retention remain incomplete. |
| M1-03 Atomic claim submission | Partial | Atomic decrement exists; server deadline, self-claim and per-member repeat restrictions are missing from the latest claim RPC. |
| M1-04 Donor accept/reject/cancellation | Missing | No complete donor decision and explained cancellation-request workflow; no agreed release/reopen operation. |
| M1-05 Edit lock/donor cancellation | Partial | Editing and archive exist; first-claim locking and explained cancellation with agreed terminal effects are missing. |
| M1-06 Expiration | Missing | Display/filter helpers exist, but strict claim/pickup server cutoffs and accepted-to-expired processing are absent. |
| M1-07 Shared terminal cleanup | Partial | Admin removal invalidates passes and writes notices; cancellation, expiry and journey cleanup integration is incomplete. |
| M2-01 Pickup pins | Partial | Real browsing map exists; post creation still writes fixed coordinates rather than a donor-selected pin. |
| M2-02 Storage photos | Partial | Bucket/policies and local preview exist; the posting path creates browser object URLs instead of uploading files to Storage. |
| M2-03 Validated post management | Partial | Create/edit/archive UI exists; required first-claim locks and explained cancellation do not. |
| M2-04 Discovery | Partial | Real queries, filters and feedback exist; an empty configured development feed falls back to samples; deadline/shared-refresh behavior is incomplete. |
| M2-05 My Posts/donor management | Partial | Active own listings exist; closed listing history and donor claim-management integration are incomplete. |
| M2-06 Permissions/APK map-upload checks | Unverified | Browser permission feedback exists; no Android acceptance evidence found, and upload/pin workflows are unfinished. |
| M3-01 Canonical shared claims | Partial | Real claim IDs/history/completion RPC replace some local-only behavior; pending/accepted are still flattened to ready_for_pickup. |
| M3-02 My Claims/donor decisions | Partial | Claimant history exists; donor acceptance/rejection controls are missing. |
| M3-03 Cancellation requests | Missing | No full request, explanation, donor decision and retained decision-history flow. |
| M3-04 QR/manual authorization | Partial | UUID pickup authorization exists; claimant QR display and equivalent donor manual-entry fallback are missing. |
| M3-05 Donor verification | Missing | Completion authorizes the claimant and accepts pending claims; no donor scan/ownership or strict deadline validation. |
| M3-06 Terminal invalidation | Partial | Completion/admin removal invalidate authorization; agreed cancellation and expiration invalidation are incomplete. |
| M3-07 On my way/scanner integration | Missing | No complete once-only departure/scanner workflow. |
| M4-01 Persisted notifications/shared refresh | Partial | Inbox/read state and moderation notices exist; full lifecycle notifications and cross-account subscriptions are incomplete. |
| M4-02 Once-only On my way | Missing | No complete persisted departure operation/UI. |
| M4-03 Consented donor-only journey | Missing | Map geolocation is local display, not donor-only latest-coordinate publishing. |
| M4-04 Journey stop/cleanup | Missing | No journey store/consent lifecycle to stop and delete. |
| M4-05 Android build | Missing | No Capacitor/Android project or APK artifact found in the inspected project paths. |
| M4-06 Two-phone release evidence | Unverified | No Defense Test Record or documented integrated APK evidence found. |
| M4-07 SMS deferred | Implemented as a scope decision | Docs explicitly defer provider setup/delivery. No live SMS is claimed or required for this package. |
| M5-01 Live admin views | Implemented | Authorized RPC-backed users/posts/claims, real dashboard and report/audit screens. |
| M5-02 Suspend/reactivate | Implemented | Reasoned, audited RPC; active-member checks block new posts/claims; existing completion/report paths remain available. |
| M5-03 Explained removal | Partial | Rejects pending/cancels accepted, invalidates passes, notifies affected users and preserves picked-up claims. Journey cleanup and complete lifecycle race verification remain outstanding. |
| M5-04 Member reporting | Implemented | Post/member reporting, reasons, self-report restrictions and own-status reads exist; suspended reporting is allowed. |
| M5-05 Report review/resolution | Implemented | Open/reviewed/resolved paths and required resolution explanation exist. |
| M5-06 Audited moderation | Implemented | Status/removal/report RPCs write audit entries in their transactions; direct role/status/removal bypass guards and real log UI exist. |
| M5-07 Security/provisioning/deployment demo | Partial | Guards, server admin checks and provisioning guidance exist; deployed desktop and full report-to-action acceptance evidence is unverified. |

## Important evidence for the remaining gaps

- `food.js:77`–`:78` writes `37.7749, -122.4194` for every new live listing. A working browse map cannot correct an incorrectly stored pickup location.
- `modules/post/PostPage.jsx:87` creates `URL.createObjectURL(file)` previews and passes the first URL as `photoUrl`. A `blob:` URL is tied to that browser; another account/device cannot use it as a permanent uploaded photo.
- Photo validation also diverges from the agreement: the form requires a photo, while the agreed photo is optional; image validation accepts broader image types rather than only JPEG/PNG/WebP. Bucket creation alone does not establish size/MIME enforcement or upload success.
- `food.js:235` labels a newly submitted claim ready for pickup. The history RPC maps both pending and accepted to that same presentation state.
- October 19 migration `complete_food_claim` at line 260 selects `claimant_id = auth.uid()`, accepts pending or accepted, and checks no pickup deadline. The agreed rule requires the donor to confirm an accepted, unexpired claim.
- The latest claim RPC's inventory UPDATE has no `expires_at > now()`, donor-self-claim exclusion or per-person active/picked-up eligibility check.
- `modules/profile/ProfilePage.jsx:39` adds 14 to the completed-claim count; displayed rescue metrics therefore are not entirely derived from actual verified pickups. Own-profile editing is also incomplete.
- `Rubric_Audit.md` is historical: its local-only completion/CSS-map statements are outdated, while its warning that PASS does not prove the revised design is still valid.

## Phase assessment

1. Shared data and authorization: partial.
2. Posting, maps and photos: partial.
3. Shared claims and cancellation: partial; most donor/cancellation behavior missing.
4. Verified pickup and deadlines: partial token foundation; agreed verification missing.
5. Notifications and journey sharing: partial notifications; journey missing.
6. Admin and reporting: mostly implemented in source; dependent cleanup/acceptance incomplete.
7. Android and defense validation: not established.

## Verification performed

- `npm test`: **18/18 passed**, rerun outside the sandbox because the Git-scanner fixture initially could not write its temporary repository.
- `npm run build`: **passed** for shared package, backend and frontend. Vite warned about a large bundle.
- No live data was changed for this review. No SQL migrations were applied. No real donor/claimant/admin workflow, concurrency test or Android test was performed.
- Existing tests focus on validation, map helpers, appearance and conflict scanning. They do not establish SQL authorization, cancellation/pickup races, token replay or multi-device correctness.

## Recommended completion order

1. Finish Member 1's state/contract and server lifecycle rules, including first-claim locks, deadlines, eligibility and transactional release/cleanup.
2. Connect Member 3 donor acceptance/cancellation and donor-only QR/manual verification to those operations.
3. Complete Member 2 donor pin selection and actual Storage upload; remove live empty-feed substitution by samples.
4. Complete Member 4 notification events, consented journey lifecycle, Android build and separate-device evidence.
5. Validate Member 5 against the completed lifecycle, run database/concurrency tests, then update the old rubric and record the defense walkthrough.

Deferred by agreement: SMS integration, background tracking, permanent bans, broadcasts and advanced analytics. These should not be counted as unfinished required defense features.
