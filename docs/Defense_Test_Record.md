# FoodRescue acceptance evidence

Date: 29 October 2026; updated 30 October 2026 (Asia/Taipei). This record separates source verification from live/device acceptance. The later request authorized Git push and Supabase deployment: all four feature migrations are applied, with Cron and notification Realtime enabled. Hosting and physical-device acceptance remain pending. See Deployment_2026-10-30.md.

## Automated/source checks

| Check | Outcome | Environment/evidence |
|---|---|---|
| Full regression suite | PASS: 37/37 | `npm test`, including isolated PGlite migrations, claim authorization, cancellation, expiration, journey privacy/cleanup, photo validation, profile counts, native callback and notification read-state tests. Run outside sandbox because its temporary Git fixture cannot write `.git/config` in sandbox Temp. |
| Shared/backend/frontend build | PASS | `npm run build`; Vite reports a large chunk advisory. |
| Diff whitespace | PASS | `git diff --check --ignore-submodules=all`; existing submodule checkout problem avoided without modifying it. |
| Linked database deployment | PASS | Four feature migrations applied transactionally; cancellation, expiration, journey RPCs, Storage limits and notification publication verified. Expiration job active every minute. |
| Browser smoke | PARTIAL | Login preview rendered at loopback port 5174. No real-account or new-migration UI acceptance claimed. |
| Android package build | PASS | Final Java 21/SDK 36 Capacitor APK assembled; debug signature verified and embedded web index matched final frontend build. Package version 1.0/code 1; min API 24/target 36. Physical installation untested. |
| Connected device check | NONE | `adb devices` listed no attached device/emulator. |

PGlite uses an isolated database and a modeled Supabase auth/Storage schema. It does not exercise the hosted Storage HTTP service, hosted Cron, or independent PostgreSQL connections racing on row locks. Those acceptance checks remain required.

## Real-device/hosted acceptance still to perform

Fill actual donor device, claimant device, Android versions, app build version and admin browser below when available. Do not mark PASS from source inspection.

| Scenario | Expected result | Status |
|---|---|---|
| Install same APK on two phones; sign in with separate accounts | Sessions and shared history persist across restart | Pending devices |
| Donor posts selected pin and optional photo; claimant opens it | Exact pin, instructions and durable photo visible on second account | Pending migrations/devices |
| No photo; invalid format; >5 MB; failed upload/save | Default image or useful failure; existing photo preserved on failure | Pending hosted Storage |
| Two independent claim submissions for last portions | No overselling; clear response for losing request | Pending independent connections |
| Donor accepts/rejects; claimant asks cancellation; donor denies/approves | Correct status, hold/release-once and notices across devices | Pending devices |
| Accepted fully reserved post | Claimant can view saved pickup pin without GPS | Pending devices |
| QR scan and manual fallback | Only owning donor confirms accepted unexpired full quantity; replay fails | Pending physical camera |
| Departure sent twice, GPS denied | One notice only; pickup still available | Pending devices |
| Explicit consent and foreground location | Donor sees latest point; unrelated member/admin denied | Pending native GPS |
| Hide/leave during GPS/startup; resume | No hidden watcher; honest paused state and usable Stop control | Pending devices |
| Manual stop, pickup, approved cancellation, donor cancellation, removal and expiry | Coordinates disappear; late updates cannot recreate journey | Pending deployed cleanup |
| Exact cutoff between scheduled runs | Server rejects new claims/pickups; history remains | Pending hosted timing test |
| Cron job executes | Due posts and claim states persist; due coordinates physically deleted | Pending Cron configuration |
| Suspension; post removal; report review/resolution | Existing arrangements preserved under suspension; removal stops pickup; audit matches actions | Pending desktop/phone integration |
| Native Google sign-in | System browser returns through configured callback; session persists | Pending provider redirect/device |
| Offline/reconnect, denied camera/location, app restart | Useful feedback and safe recovery; no invented success | Pending devices |
| Hosted admin route hard reload/member denial | Correct SPA route, authorized admin, denied member RPC access | Pending hosting |

## Device record

### October 30 release-readiness update

- Full regression suite: 65/65 passed, including exact notification destinations, recipient isolation, target immutability and retained identity after report deletion. Final changed SQL harness rerun: 8/8 passed.
- Lint, shared/backend/frontend production builds and dependency audit passed (zero known vulnerabilities).
- New notification destination migration applied to linked project `tbmmqimhhazbuazetdwa`; installation and active expiration Cron verified. This does not count as cross-device acceptance.
- `adb devices` returned no attached devices. Recovery email delivery and hosted Auth redirect settings remain pending; exact setup and test-account steps are in `Recovery_Release_Acceptance_2026-10-30.md`.
- Pickup-map redesign is documented in `Pickup_Map_Redesign_Plan_2026-10-30.md`; the map interface has not been redesigned in this package.

- Donor device / Android / build: pending.
- Claimant device / Android / build: pending.
- Desktop browser / hosted URL: pending (deployment files only).
- Screenshots/recordings of real workflows: pending.

SMS, background tracking, permanent bans, broadcasts and advanced analytics remain deferred by agreement.
