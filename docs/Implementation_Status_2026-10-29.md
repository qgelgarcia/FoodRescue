# FoodRescue implementation status — 29 October 2026

Historical checkpoint: the later 30 October request authorized Git and Supabase deployment. All four feature migrations have since been applied; see [deployment record](Deployment_2026-10-30.md). The source/package checks and pending gates below describe the earlier checkpoint, not current migration status.

The remaining feature package is implemented in source and packaged for deployment review. The user requested deployment files only. No new migration was applied, no hosting published and no physical-device acceptance is claimed.

## Delivered

- Donor-selected Leaflet pickup pins with validated saved coordinates, address/instructions and claimant pin access even when the listing is fully reserved.
- One optional JPEG/PNG/WebP photo, maximum 5 MB, uploaded to owner-scoped Supabase Storage. The bucket enforces size/MIME limits. Failed saves reconcile whether the upload was persisted before cleanup; replacement/removal deletes an unreferenced old photo after successful save.
- All-state donor listing history, first-claim edit-lock UI and explained donor cancellation through an owner-authorized transactional RPC. Pending claims reject, accepted claims cancel, passes invalidate, outstanding cancellation requests close and claimant notices persist. Completed pickups remain.
- Idempotent expiration processing for active and fully reserved posts, persisted terminal states/notices and conditional one-minute Cron registration. Existing server deadlines remain authoritative between runs.
- Persisted pickup/departure notifications and visible-page refresh across feed, map, listing history, profile counters, notification inbox and pickup badges. Claims retain their existing scoped refresh behavior.
- Once-only On my way, separate explicit location consent, native/browser foreground updates, donor-only latest coordinates, stale/unavailable states and manual stop. Session tokens and increasing sequence numbers reject late/reordered updates; terminal transitions delete the latest point. Async startup cannot start a hidden watcher; interrupted sharing retains a Stop control if cleanup fails.
- Own-profile name/phone editing through existing owner RLS and protected moderation fields. Verified portion totals exclude samples and invented offsets; unsupported environmental conversion cards and fabricated achievements were removed.
- Capacitor Android source, camera/foreground location permissions, cutout/navigation spacing and a native Google OAuth PKCE callback. The callback redirect must be allowed in the target Supabase project before device acceptance.
- Reproducible Windows APK build script, static-host SPA routing files, service contracts, release setup and an honest defense acceptance checklist.

## Verification

- `npm test`: **34/34 passed**. Isolated PGlite tests apply all repository migrations and cover ownership/deadlines, claim decisions, release-once, pickup replay, donor cancellation, expiration, private sharing and terminal cleanup. Pure helper tests cover file constraints, profile totals and callback validation. The Git-fixture test requires execution outside the restricted sandbox Temp directory.
- `npm run build`: **passed** for shared models, Express backend and frontend. Frontend rebuilt after the final sharing-startup fix; only the existing large-chunk advisory remains.
- `npm run check:conflicts`: **passed**. `git diff --check --ignore-submodules=all`: **passed** after whitespace cleanup. Existing unrelated submodule status failure was not repaired or altered.
- `npx cap sync android` and Java 21/SDK 36 `gradlew assembleDebug --no-daemon`: **passed** for the final frontend and three native plugins.
- APK signature verification: **passed** using Android `apksigner`. Embedded web index matches the final frontend build. Package `org.foodrescue.campus`, version 1.0/code 1, minimum API 24, target API 36.
- Browser smoke: login preview rendered; no authenticated new-feature browser acceptance claimed.
- Read-only linked Supabase check: prior claim operations installed, three October 29 migrations pending. No real data changed.
- `adb devices`: no connected device/emulator; physical camera/GPS/two-phone checks remain pending.
- Independent source review identified pickup-pin visibility, photo cleanup and interrupted-sharing UI issues; these were corrected. No deployment or device verification is inferred from that review.

## Local release artifacts

- `output/release/FoodRescue-debug.apk` — debug-signed installable test build, about 9.4 MB; not a signed store release.
- `output/release/FoodRescue-web.zip` — final static frontend (members and desktop admin), about 660 KB compressed.
- `output/release/migrations/` — three new migrations in dependency order.
- `output/release/vercel.json` — optional Vercel SPA routing; `_redirects` is included in the static bundle for compatible hosts.

Build outputs are ignored by Git. Source project/configuration/migrations/docs remain reviewable in the workspace. Existing unrelated local document/output changes were preserved.

## Remaining release gates

1. Review/apply the three new migrations to the intended environment and confirm Supabase Cron actually runs expiration cleanup. Until applied, the new RPCs and columns are unavailable to the app.
2. Configure the native auth redirect and prepare the chosen HTTPS host using Release_Setup_FoodRescue.md. Hosting publication was explicitly deferred.
3. Complete Defense_Test_Record.md with two Android devices, separate donor/claimant accounts, desktop admin, hosted Storage, permission denial, physical QR, location/stale/offline behavior and independent-connection races.
4. Existing backend runtime audit reports body-parser and qs advisories. They were not introduced by the native feature package and were not upgraded in this implementation; review them before a hosted backend release.

No SMS, background location, permanent bans, broadcasts or advanced analytics were added; those remain deferred by agreement.
