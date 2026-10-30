# Next implementation and release work

Updated 30 October 2026. This replaces the old missing-feature list: donor decisions, claim cancellation, QR/manual pickup, pins, uploads, donor post cancellation, expiry processing, journey sharing, profile editing and help content already exist in source. Notifications now include full unread counts, Read all and live refresh; the shared member header sits outside page transitions.

## Required to deliver the agreed scope

| Order | Work | Completion check |
|---|---|---|
| 1 | DEPLOYED: all three October 29 feature migrations. Complete account/device acceptance. | Posting/upload constraints, post cancellation, expiry and journey RPCs are installed on the linked project. Still demonstrate the complete real-account workflow on devices. |
| 2 | ENABLED: expiration Cron job; verify ongoing operation. | The active job runs `expire_food_posts()` once per minute. Confirm successful run history and complete the expiry/device acceptance checks. |
| 3 | DEPLOYED: October 30 notification Realtime migration; complete cross-account acceptance. | Notification table is in the Realtime publication. Confirm a donor/claimant action creates a notification on another session; Read all followed by one new row produces badge 1 and survives reload. |
| 4 | Configure native and hosted authentication callbacks. | Email/password and Google sign-in return correctly to the installed Android app and the chosen web origin; sessions persist across restart. |
| 5 | Rebuild release artifacts from the latest source. | APK and web bundle include the later profile crash fix, theme/help improvements, dynamic notifications and stationary header. Existing October 29 packages predate these UI updates. Verify signing and embedded assets again. |
| 6 | Complete two-phone and independent-database-connection acceptance. | Real Storage uploads, pin accuracy, denied camera/GPS, foreground sharing, stale/offline states, cleanup, claim races, cancellation/pickup races and code replay pass. Fill Defense_Test_Record.md with actual device/build evidence. |
| 7 | Verify the desktop admin against the completed lifecycle, then publish only when requested. | Member access denied; suspension preserves existing arrangements; removal stops outstanding pickups; report resolution and audit history remain correct. Hosting publication remains deferred by user preference. |
| 8 | Review existing backend dependency advisories before hosting the API. | Patch compatible body-parser/qs dependencies and rerun backend checks; the prior audit finding is not proof of current advisory status. |
| 9 | Finalize operator-owned support/privacy information. | Campus operator supplies the real support contact/channel and approves published community/privacy wording. No support email, response-time guarantee or live chat is invented. |

Supabase requires adding the table to the Realtime publication for Postgres Changes delivery; client subscriptions alone do not enable it. Follow the official [Postgres Changes setup](https://supabase.com/docs/guides/realtime/postgres-changes). Existing recipient RLS must remain enforced. The fallback refresh still works without live replication.

## Useful next feature additions, outside the confirmed minimum

These are proposals rather than unfinished required defense features:

- **Forgot password:** request/reset screens and secure web/native reset callback handling. The current auth UI has no complete password-recovery flow.
- **Profile photo management:** optional avatar upload/removal with Storage ownership, format/size validation and replacement cleanup. Current profile editing covers name and phone.
- **Full notification history:** pagination/load more, unread filtering and navigation to the affected claim, post or report. The dropdown shows recent notifications; its full unread total is independent of that display limit.
- **UI failure recovery:** a page error boundary with recovery action, plus a JSX undefined-identifier check so an omitted icon import cannot silently pass the production build again.
- **Broader UI acceptance:** keyboard navigation, mobile widths, theme contrast and loading/error/empty states across all member/admin routes. Earlier local checks covered specific routes, not every screen or device.

## Explicitly deferred

SMS provider integration, background location, permanent bans, broadcasts and advanced analytics remain deferred. Push notifications and chat are not part of the agreed minimum either; they should be scoped separately if requested.

The later user request authorized Git push and Supabase deployment, now recorded in Deployment_2026-10-30.md. This list does not itself authorize website hosting publication or provider-account changes.

Verification for this update: 37/37 automated tests and the frontend production build passed. Notification tests use an injected in-memory client and cover a full count beyond 20, snapshot Read all, a new arrival remaining unread with count 1 and recipient-scoped individual reads. Browser checks confirm the Read all control and one stationary header outside the animated page. Existing live notifications were not marked read during verification.
