# Next feature implementation status — 30 October 2026

## Implemented

- Routed member-page error boundary with Retry/feed recovery, retaining the shared header and dock. Undefined JSX identifiers are checked by ESLint and CI.
- Forgot-password request and session-gated reset screens, generic request confirmation, explicit expired/invalid handling, separate exact web/native recovery routing and same-session refocus support.
- Private profile photo chooser/camera input, preview/save/remove, owner-scoped randomized Storage references, signed URL renewal, cautious replacement reconciliation and header refresh.
- Full notification center with All/Unread, Read all, stable cursor Load more, authorized related-post history destinations, authoritative refresh of loaded rows, reconnect/focus/polling fallback and independent header/center subscriptions.
- Support contact: `FoodRescue@gmail.com`, supplied by the project owner.
- Compatible dependency updates; current audit reports zero known vulnerabilities.

## Verification

- `npm run lint`: passed.
- `npm test`: 65/65 passed, including lifecycle/RLS fixtures, private-avatar policies, recovery session tracking, exact notification destinations, notification arrival/read/pagination races and page recovery. The changed SQL harness also passed after the deleted-target fix (8/8).
- `npm run build`: shared, backend and frontend passed. Existing large-bundle warning remains; this is not a build failure.
- `npm audit --audit-level=low`: zero known vulnerabilities.
- Browser: profile controls render; notification center loads real rows alongside the stationary header; Unread shows the empty state when appropriate. Ordinary signed-in access to `/reset-password` is denied without a recovery link. No real recovery email, password change or avatar upload was performed.
- `20261030020000_profile_avatars.sql` applied transactionally to linked Supabase project `tbmmqimhhazbuazetdwa`; private bucket limits verified. Existing lifecycle functions, notification publication and active expiration Cron verified; latest Cron run succeeded.
- Capacitor sync and Android `assembleDebug` passed. APK v2 signature verifies. No Android device was connected (`adb devices` empty).
- Fresh local artifacts: `output/release/FoodRescue-debug.apk` and `output/release/FoodRescue-web.zip`. These are prepared packages, not a published website/store release.

SHA256:

```text
FoodRescue-debug.apk  C07FA15789198CEE050CD51C5028C77F1ABD4E0F5AE386B4B12C77CDF1B8483B
FoodRescue-web.zip    36E5C7F8B382D0A1946677793AF4F66AA3E03DA69F71768DEDCDCF60F3AB2401
```

## Still required for release acceptance

- Configure/verify exact Supabase Auth redirect allowlists for the selected web origin and `org.foodrescue.campus://auth/recovery`, retaining the Google callback. Hosting remains preparation-only as requested.
- Test real recovery email delivery and valid/expired link behavior on web and Android with designated test accounts.
- Run two-device donor/claimant acceptance, including physical camera/gallery, permission denial, GPS, offline recovery and independent-connection race checks. Complete `Defense_Test_Record.md` with actual evidence.
- Obtain operator review of the published policy/community copy. The provided support address is displayed; mailbox delivery/ownership was not independently tested.

## Release-readiness continuation

- Compact profile editor and avatar icon are included in these refreshed packages.
- Exact server-produced claim/report destinations are implemented; removed targets retain identity and show the authorized unavailable state. Recipients cannot change notification content or target IDs. Migration `20261030030000_notification_destinations.sql` is deployed and permissions verified.
- Local Supabase callbacks now include the actual port 5175 and the two exact native intents. Hosted settings and actual email delivery remain unverified; see `Recovery_Release_Acceptance_2026-10-30.md`.
- Notification filters support arrow keys and Home/End with one tab stop.
- Standards and specification reviews passed after correcting the removed-target fallback. The final APK signature verifies and its embedded index matches the final web build.
- `Pickup_Map_Redesign_Plan_2026-10-30.md` records the proposed desktop split layout, phone Map/List views, synchronized listing selection and persistent map viewport. Map redesign implementation is not part of this batch.
- The implementation and supporting plans are prepared as one reviewed Git release-readiness batch. Website hosting remains preparation-only.
