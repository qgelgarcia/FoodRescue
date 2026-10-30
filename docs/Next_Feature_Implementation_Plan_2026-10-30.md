# FoodRescue next feature implementation plan

Prepared 30 October 2026. Status: planning only; these new features have not been implemented by this document.

## Baseline and objective

The existing package includes donor/claimant workflows, verified pickup, map pins, Storage photos, cancellation, expiry, journey sharing, profile name/phone editing, help content, unread notifications/Read all and a stationary member header. The four feature migrations are now applied to linked Supabase, notification Realtime is enabled, and the expiration Cron job has a successful run. Preserve those workflows rather than rebuilding them.

The next package should improve account recovery, personal profiles, notification navigation and UI resilience. Deliver each phase as a reviewable change with its targeted tests. Do not add SMS, background location, chat or analytics to this package.

## Phase 0 — Close the current release checks

Before treating the existing package as released:

- Rebuild the APK and web bundle from the latest committed source; the earlier packages predate later UI fixes.
- Confirm the native Google callback and intended web origin in Supabase Auth settings.
- Run the existing acceptance record on two actual devices/accounts and a desktop admin, including physical camera/GPS, Storage uploads, denial/offline recovery and independent-connection races.
- Review the backend dependency advisories and patch compatible versions before publishing that API.
- Get the actual campus support channel and owner approval of community/privacy copy. Do not invent contact details or response times.

Completion: current release evidence is recorded honestly. Source development below can proceed while devices/operator details are being arranged; publication waits for its own acceptance gates and authorization.

## Phase 1 — Page failure recovery and JSX checks

Why first: an omitted icon import previously blanked the entire member interface even though the production build passed.

Implementation:

- Add a small React error boundary around routed page content in App.jsx. Keep the shared header and dock outside it so members can leave a failed page.
- Show a theme-aware error state with Retry and a route back to the feed. Reset the boundary on navigation. Avoid displaying raw stack traces or sensitive service responses.
- Keep existing explicit handling of failed requests/actions; an error boundary does not handle asynchronous failures or event-handler errors automatically.
- Add a focused JSX undefined-identifier lint check to the frontend and CI, including the missing-import pattern that caused the profile crash. Avoid unrelated formatting rewrites.

Primary files: App.jsx, a new PageErrorBoundary component, frontend/root package scripts, a minimal lint configuration and the CI quality gate.

Acceptance:

- A deliberately throwing page shows recovery content while the header and navigation remain usable.
- Navigation/retry recovers without logging the member out; raw exception details are not shown publicly.
- A JSX fixture using an unimported icon fails lint; valid components pass.
- Keyboard focus and dark/light readability remain usable in the error state.

## Phase 2 — Forgot password and secure reset

Implementation:

- Add a Forgot password action on sign-in, an email-request screen and a reset-password screen.
- Use Supabase's supported recovery flow; verify current official web/native behavior before coding callback handling.
- Show the same email-request confirmation regardless of whether an account exists. Handle request throttling and network failures without claiming an email was sent when the request failed.
- Extend the existing exact callback allow-list with a dedicated recovery callback. Keep recovery navigation separate from the normal Google sign-in redirect; do not let the normal auth listener send the recovering member straight to the feed.
- Require a valid recovery session before enabling password changes. Reuse the existing password/confirmation rules and show clear expired, invalid and already-used link states.
- Never log or retain recovery URLs/tokens in screenshots, telemetry or browser query strings after they have been handled.

Primary files: Login.jsx, auth.js, native-auth-callback helpers, NativeAuthCallback, app routes and new recovery components. Deployment configuration must allow the intended web/native recovery redirects.

Acceptance:

- Web and Android can request a recovery email, open a valid link, set a password and sign in again.
- Invalid/expired/replayed links do not allow changes; unknown-email behavior does not disclose account existence.
- Google sign-in, ordinary login and existing sessions still work.
- Tests cover callback routing, password validation and error states; actual email delivery and device deep links are recorded separately.

## Phase 3 — Profile photo upload and removal

Implementation:

- Add an optional avatar chooser, preview, save/replace and remove action to the profile.
- Reuse the established image validation and upload conventions: JPEG/PNG/WebP, up to 5 MB, randomized owner-scoped paths. Store a durable URL/reference and use initials when absent.
- Add a dedicated avatar bucket with explicit limits and owner-write/delete policies. Decide its read visibility from the profile contexts already visible in the app; do not broaden profile access just to display an avatar.
- Keep the old photo until a replacement is saved. On failure, reconcile whether the save succeeded before cleaning up the new upload. Remove old objects only when unreferenced and owned by the member.
- Refresh the stationary header after profile save so its avatar changes without requiring sign-out.

Primary files: ProfilePage.jsx, auth/profile service, a small avatar service, shared image validators and one additive Storage migration.

Acceptance:

- A saved avatar survives reload and appears in the header; removal restores initials.
- Other members cannot overwrite/delete the file. Oversized/unsupported files fail with useful feedback.
- Failed replacement preserves the previous avatar; unsuccessful saves do not remove an image that was actually committed.
- Web chooser and Android camera/gallery paths work, including denied/cancelled selection.

## Phase 4 — Full notification center and useful destinations

Implementation:

- Add a full notification page reachable through See all in the existing dropdown. Keep the header badge based on the full unread total.
- Add All/Unread views and Load more using a stable created_at/id cursor, not a growing offset that shifts when new rows arrive.
- Reuse the existing individual-read, Read all, recipient filters, Realtime subscription and refresh fallback. Share the result of reads with the header so totals do not disagree across views.
- Use related_post_id to navigate to available listing context or the appropriate history screen. For precise claim/report navigation, add nullable typed references only where the event producer knows the correct canonical ID; do not guess a destination from message text.
- Add focused-item handling in the destination and an honest unavailable/removed state. Following a notification must not bypass normal authorization or resurrect a terminal action.

Primary files: notification service/state helpers, CustomerHeader.jsx, a NotificationsPage, App.jsx routes, claim/report destination handling and an additive migration only if new event references are necessary.

Acceptance:

- More than 20 notifications can be browsed without duplicates or gaps as new items arrive.
- After Read all, the badge disappears; a later unread arrival returns it to 1. Opening an already-read item never decrements twice.
- Other users' rows remain inaccessible; a forged destination ID does not grant access.
- Expired/removed targets show helpful context, and offline/reconnect behavior preserves server-authoritative read state.

## Phase 5 — Accessibility, integration and release

- Run keyboard/focus checks across profile help, reports, notification menus, recovery and avatar controls.
- Check narrow Android widths and desktop layouts in both themes, including loading, empty, error, disabled and long-text states. Use theme tokens rather than blanket white/black overrides.
- Run the full regression suite, lint, shared/backend/frontend builds and database/Storage authorization tests for changed behavior.
- Rebuild/sync the Android app; verify callback registration, permissions, image selection and the stationary header on physical devices.
- Update service contracts, privacy/help text, the defense test record and release instructions to match the shipped features.

Completion: accepted source, migration order, current APK/web artifacts and actual test evidence are available. Apply new migrations or publish artifacts only under the deployment authorization applicable at that time.

## Dependencies and delivery order

1. Resilience/lint establishes a gate for all later UI changes.
2. Recovery uses the existing native callback infrastructure and requires approved redirect configuration.
3. Avatar work can follow independently once its Storage visibility is agreed.
4. Notification center builds on the already implemented unread/Read all package and deployed replication.
5. Integrated release checks cover the combined result.

Keep one writer per shared file during integration: App.jsx, CustomerHeader.jsx, auth.js, styles and package-lock.json are common touch points. Prefer existing services and validators; avoid a new state-management library unless a concrete need is demonstrated.

## Decisions needed before their dependent phase

- Campus operator: real support contact, published policy wording and acceptable avatar visibility.
- Release owner: intended HTTPS host/origin, native recovery redirect and access to two test phones.
- Product owner: whether precise notification destinations should focus claims/reports in this package, beyond the existing post reference.

These decisions do not block resilience/lint or the initial recovery UI work. No calendar estimates are imposed without team availability or a target release date. This plan does not start implementation of the proposed features.
