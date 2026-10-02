# FoodRescue — Rules

## 1. Business Rules

### 1.1 Posting
- BR-1: A post's `quantity_total` must be a positive integer.
- BR-2: A post must have a pickup location (lat/lng + address) and an `expires_at` in the future at creation time.
- BR-3: Only the donor who created a post may edit or cancel it (unless overridden by an admin).
- BR-4: A post cannot be edited once it has any `accepted` or `picked_up` claims against it, except to shorten (never extend) the deadline.

### 1.2 Claiming
- BR-5: A claim's `quantity_claimed` must be ≤ the post's current `quantity_remaining` at the moment of claiming.
- BR-6: A user cannot claim their own post.
- BR-7: A user may have multiple pending claims across different posts, but only one active (non-cancelled, non-rejected) claim per post.
- BR-8: When `quantity_remaining` reaches 0, the post status changes to `fully_claimed` and it disappears from the active feed.
- BR-9: A claim can only move `pending → accepted/rejected` by the donor, and `accepted → picked_up` by the donor confirming.
- BR-10: A claimant may cancel only while their claim is `pending`.

### 1.3 Expiration
- BR-11: Once `expires_at` passes, the post automatically becomes `expired` regardless of remaining quantity, and is hidden from the public feed (still visible in the donor's own history).
- BR-12: Pending claims on an expired post are automatically marked `rejected` (food is no longer available/safe).

### 1.4 Notifications
- BR-13: A `new_post_nearby` notification is only sent to users within a defined radius (default: campus-wide or a configurable distance) of the pickup location.
- BR-14: A `pickup_reminder` is sent a set time before `expires_at` (default: 30 minutes) to the donor and any accepted claimants.

### 1.5 History & Accountability
- BR-15: Every claim, regardless of final status, remains permanently in the `claims` table for history/audit — no hard deletes.
- BR-16: A user's history should reflect both roles: posts they've donated and claims they've made.

## 2. Moderation & Admin Rules
- BR-17: Only accounts with `role = 'admin'` may access `/admin/*` routes and admin-only tables/actions.
- BR-18: Admin accounts are not self-registrable through the public sign-up form; they are provisioned directly in the database or by an existing admin.
- BR-19: Any admin action that modifies another user's data (ban, post removal, report resolution) must be recorded in `admin_logs` with actor, action, target, and timestamp — no silent admin actions.
- BR-20: A `suspended` user can log in but cannot post or claim; a `banned` user cannot log in at all.
- BR-21: Reports must be reviewed by an admin and marked `reviewed` or `resolved` — they cannot be deleted, to preserve an audit trail.

## 3. Security Rules (enforced via RLS, not just client code)
- SR-1: A user can only `select`/`update` their own `profiles` row, except admins, who can view all.
- SR-2: A user can only `insert`/`update` `food_posts` where `donor_id = auth.uid()`, except admins.
- SR-3: A user can only view active posts or their own posts; hidden/expired/removed posts are not queryable by regular users.
- SR-4: A user can only `insert` claims where `claimant_id = auth.uid()`.
- SR-5: A donor can only update the status of claims tied to posts they own.
- SR-6: A user can only view notifications where `user_id = auth.uid()`.
- SR-7: Quantity decrements must go through the `claim_food` RPC function (`security definer`) — direct client-side `update` on `quantity_remaining` is blocked by RLS policy design (no direct update policy grants that column to regular users).
- SR-8: All destructive or role-elevated actions (ban, remove post, resolve report) require `profiles.role = 'admin'`, checked inside the RLS policy itself, not just hidden in the UI.

## 4. Validation Rules (client + DB constraints)
- VR-1: Email must be valid format; password minimum 8 characters (enforced by Supabase Auth).
- VR-2: `food_name` and `pickup_address` are required, non-empty strings.
- VR-3: `quantity_total > 0` and `quantity_remaining >= 0` (DB check constraints).
- VR-4: `expires_at` must be a future timestamp at creation (validated client-side before insert; can add a DB check constraint referencing `created_at`).
- VR-5: `quantity_claimed > 0` and cannot exceed remaining quantity (enforced in the `claim_food` function, not just the UI).
- VR-6: File uploads to `food-photos` limited to image types and a reasonable size cap (e.g. 5MB) via Storage bucket policy.

## 5. UX Rules
- UXR-1: Expired posts must never appear in the active feed, even briefly — rely on the scheduled job, not just a client-side date filter, since the job also blocks new claims server-side.
- UXR-2: Countdown timers update live client-side (no need to re-fetch every second) but should re-sync with server `expires_at` periodically to avoid client clock drift.
- UXR-3: Any action that can fail due to concurrency (e.g., "claim just ran out") must show a clear, friendly error, not a raw exception message.
