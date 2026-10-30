# FoodRescue — Specifications

This is the confirmed school-defense target, not a statement of current implementation. See [Design Agreement](Design_Agreement_FoodRescue.md), [Rules](Rules_FoodRescue.md), and [Rubric Audit](Rubric_Audit.md).

## Delivery and accounts
- Ionic React member app delivered as an Android APK; desktop web admin from the same codebase.
- Supabase Auth, Postgres, Storage, RPC, and shared updates. Existing Express TypeScript health service remains.
- Student, org, and provider accounts can donate and claim. Admins are provisioned separately.
- Registration, login/logout, session persistence, and own-profile viewing/editing are required. Members cannot assign themselves admin privileges.

## Posting and discovery
- Create food offerings with name, description, category, positive whole-number quantity, future pickup deadline, map pin, address, and instructions.
- One optional JPEG, PNG, or WebP photo up to 5 MB, stored in Supabase Storage; use a default image if absent and show upload failures clearly.
- Interactive maps must work live. A CSS map or hardcoded coordinates do not satisfy the target.
- Show available, unexpired posts and countdowns; own posts and related claims remain accessible in history.
- Lock food details, quantity, location, deadline, and photo after the first claim. Donor cancellation requires an explanation.

## Claims and pickup
- Pending claims immediately reserve portions atomically. Donors accept or reject them.
- One pending or accepted claim per member per post; no repeat after pickup. Retry after rejection/cancellation is allowed before the deadline when portions remain.
- Cancellation of pending or accepted claims requires explanation and donor approval. Reservations remain held until approval or closure.
- Released reservations reopen fully reserved posts before their deadline unless cancelled/removed. Never release twice.
- Donor confirms full-quantity pickup by scanning the claimant's opaque single-use QR, or entering its manual fallback code. The server validates ownership, state, deadline, and single use.
- At or after the deadline, block claiming and pickup; reject pending claims and expire accepted uncollected claims. Only verified pickups count as redistribution.

## Journey sharing and notifications
- On my way is optional, once per accepted unexpired claim.
- With explicit consent, share latest foreground location only with that claim's donor. Show stale/unavailable location honestly.
- GPS denial does not block On my way or pickup. Stop sharing on manual stop or claim/post closure; delete coordinates and keep no route history.
- Shared in-app updates cover decisions, cancellation, and moderation.
- SMS acceptance-to-claimant and departure-to-donor integration is intended through Edge Functions for Philippine numbers, but SMS work/provider setup is deferred. On SMS failure, use in-app notification without undoing the action.

## Admin and reporting
- View users, posts, and claims; suspend/reactivate users; remove posts with an explanation; review/resolve reports; audit every moderation change.
- Suspension blocks new posting/claiming, while permitting login, history, and existing arrangements.
- Removal stops outstanding pickups, invalidates tokens, notifies affected members, and preserves completed history.
- Any signed-in non-admin, including suspended members, can report a post or another member with an explanation; no self-reporting.
- Reporter sees own report status. Admin flow: open → reviewed → resolved, with a required resolution explanation. Retain reports.

## Quality and deferred scope
- Server-side authorization, atomic inventory/state transitions, shared persisted history, friendly errors, loading/empty states, and responsive layouts are required.
- Verify camera, location, upload, and shared workflows on the APK and moderation in a desktop browser.
- Deferred: SMS integration/setup, background tracking, permanent bans, broadcasts, advanced analytics. No payments, chat, or partial pickup in the agreed core flow.
- Distance sorting, push delivery, nearby alerts, and timed reminders are not confirmed defense requirements.
