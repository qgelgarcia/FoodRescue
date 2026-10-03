# FoodRescue — Walkthrough

This document describes the end-to-end journey for each user type, screen by screen.

> This is the target product journey. Current prototype limitations and manual checks are
> listed in `Rubric_Audit.md`.

## 1. Onboarding & Auth (shared)
1. User opens app → **Login screen**.
2. New user taps "Register" → fills name, email, password, phone, selects role (`student`, `org`, `provider`).
3. On successful login, app checks `profiles.role`:
   - `admin` → redirected to `/admin/dashboard`
   - anyone else → redirected to `/app/home-feed`

## 2. Donor Journey (posting food)
1. Donor taps **"+ New Post"** on Home Feed or Create Post tab.
2. Fills form: food name, description, category, quantity, display photo preview, pickup address, and expiration/time limit.
3. Submits → post inserted into `food_posts`, `status = 'active'`.
4. Post appears in nearby users' feeds sorted by distance/deadline, and triggers a `new_post_nearby` notification to nearby subscribed users.
5. Donor watches **My Posts** — sees countdown timer and quantity remaining live (Realtime updates as claims come in).
6. When a claim request arrives, donor gets a `claim_received` notification, opens the post's claims list, and taps **Accept** or **Reject**.
7. When the claimant arrives, donor marks the claim **Picked Up** — this closes the transaction and logs it to history.
8. If quantity hits 0, post auto-flips to `fully_claimed`. If `expires_at` passes first, the scheduled job flips it to `expired` and hides it from the feed.

## 3. Claimant Journey (claiming food)
1. Claimant opens **Home Feed** — sees list of active posts sorted by distance or deadline, each with countdown timer.
2. Taps a post to view details: photo, description, remaining quantity, pickup location on map.
3. Taps **Claim**, specifies quantity (up to remaining), submits.
4. Claim inserted with `status = 'pending'` via the atomic `claim_food` RPC (quantity decremented immediately and safely).
5. Claimant sees the claim under **My Claims** with live status updates: `pending → accepted/rejected → picked_up`.
6. Gets a `pickup_reminder` notification as the deadline approaches.
7. Picks up food in person; donor marks it picked up; transaction appears in claimant's **History**.

## 4. Notifications Flow (both roles)
| Trigger | Recipient | Type |
|---|---|---|
| New post created nearby | Nearby users | `new_post_nearby` |
| New claim submitted | Donor | `claim_received` |
| Donor accepts claim | Claimant | `claim_accepted` |
| Donor rejects claim | Claimant | `claim_rejected` |
| Deadline approaching | Donor + pending claimants | `pickup_reminder` |

## 5. Admin Journey (web dashboard)
1. Admin logs in via the same login screen, redirected to `/admin/dashboard`.
2. **Dashboard** — sees key metrics: active posts, total food redistributed, active users, open reports.
3. **User Management** — searches/filters users, views profile detail, suspends or bans accounts that violate rules.
4. **Post Moderation** — views all posts (active, expired, removed), can force-remove a post that violates guidelines (`status = 'removed_by_admin'`).
5. **Reports Queue** — reviews reports filed by users against posts or other users, marks them `reviewed`/`resolved`, and takes action (ban/remove) if warranted.
6. **Claims Monitor** — oversees disputes, e.g. a claimant who repeatedly no-shows; can view claim history per user.
7. **Broadcast** — sends an announcement notification to all users or a segment (e.g. all donors).
8. **Activity Logs** — every admin action (ban, removal, resolution) is recorded in `admin_logs` for accountability.

## 6. End-to-End Example Scenario
1. A campus org posts "30 sandwiches, expires in 2 hours" with a pin at the student center.
2. Three students nearby get a `new_post_nearby` push notification.
3. Student A claims 5, Student B claims 10 — both decrements happen atomically, feed shows "15 remaining" live to everyone still viewing.
4. Org accepts both claims.
5. Student A picks up, org marks it picked up. Student B never shows up.
6. At the 2-hour mark, remaining 15 sandwiches expire and the post disappears from the feed.
7. Student A's transaction appears in both their histories. The org can later report Student B's no-show, which lands in the admin's Reports Queue.
