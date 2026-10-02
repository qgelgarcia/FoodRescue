# FoodRescue — Development Phases

## Phase 0: Setup
- Initialize Ionic + Angular project (`ionic start foodrescue blank --type=angular`).
- Create Supabase project; note API URL and anon key.
- Install `@supabase/supabase-js`, Leaflet, and Capacitor plugins (geolocation, push notifications).
- Set up folder structure: `modules/auth`, `modules/user`, `modules/admin`, `services`, `guards`.
- Configure environment files (`environment.ts`) with Supabase credentials.

## Phase 1: Database & Auth Foundation
- Create all tables in Supabase: `profiles`, `food_posts`, `claims`, `notifications`, `reports`, `admin_logs`.
- Add trigger to auto-create a `profiles` row on `auth.users` insert.
- Enable RLS and write all policies (see `Rules_FoodRescue.md` and `Database_FoodRescue.md`).
- Build shared `AuthModule`: register, login, logout, session persistence.
- Build `AuthGuard` and `RoleGuard`; implement post-login role-based redirect.
- **Milestone:** a user can register, log in, and land on the correct home screen based on role.

## Phase 2: Core User Module — Posting
- Build `supabase.service.ts` and `posts.service.ts`.
- Build **Create Post** screen: form + Leaflet map picker for pickup location + photo upload to Storage.
- Build **My Posts** screen: list donor's own posts with live status/quantity.
- Implement the `claim_food` RPC function and scheduled expiration cron job in Supabase.
- **Milestone:** a donor can create a post, see it saved, and see it auto-expire after its deadline.

## Phase 3: Core User Module — Claiming
- Build **Home Feed**: active posts list, sorted by distance/deadline, countdown timers, Realtime subscription for live quantity updates.
- Build **Post Detail** screen with map view of pickup location.
- Build **Claim Food** flow calling the `claim_food` RPC.
- Build **My Claims** screen with live status tracking.
- Build donor-side claim management (accept/reject/mark picked up) inside My Posts.
- **Milestone:** two test accounts can post and claim food end-to-end, with quantities updating live for both.

## Phase 4: Notifications & History
- Integrate Firebase Cloud Messaging for push notifications (new post nearby, claim received/accepted/rejected, pickup reminder).
- Build in-app **Notifications** inbox with read/unread state.
- Build **History** screens for both donor and claimant views.
- **Milestone:** all notification triggers fire correctly and are visible both as push and in-app.

## Phase 5: Admin Module
- Build `admin.service.ts` and the `/admin/*` route module with `ion-split-pane` layout.
- Build **Dashboard** with summary metrics (active posts, food redistributed, active users, open reports).
- Build **User Management** (search/filter/suspend/ban).
- Build **Post Moderation** (view all, remove violating posts).
- Build **Reports Queue** (review/resolve).
- Build **Claims Monitor** (dispute oversight).
- Build **Broadcast** tool (send announcement notifications).
- Build **Activity Logs** view sourced from `admin_logs`.
- **Milestone:** an admin account can log in, see live metrics, and moderate users/posts/reports.

## Phase 6: Polish & Hardening
- Add empty states, loading states, and error handling (especially for claim race-condition failures).
- Responsive pass on admin views (desktop-first) and mobile views (one-handed use).
- Add distance-based sorting using device geolocation + Haversine calculation.
- Review all RLS policies against the Rules doc — attempt to break them with a non-owner/non-admin test account.
- Basic automated tests for the `claim_food` function (concurrency test: two simultaneous claims exceeding total quantity should not oversell).

## Phase 7: Deployment & Demo Prep
- Build and deploy the admin/web bundle (Netlify/Vercel/Firebase Hosting) or serve the single PWA build.
- Build Capacitor mobile package for demo (Android APK is usually enough for a school defense).
- Seed the database with realistic demo data (a handful of posts, users, and claims in various states).
- Prepare a walkthrough script matching `Walkthrough_FoodRescue.md` for the live demo/defense.

## Suggested Order for Antigravity Sessions
1. Phase 0 + 1 (setup + auth) — one session.
2. Phase 2 (posting) — one session.
3. Phase 3 (claiming) — one session, this is the most complex due to the atomic RPC.
4. Phase 4 (notifications/history) — one session.
5. Phase 5 (admin) — one or two sessions, since it has many screens.
6. Phase 6 + 7 (polish + deploy) — final session before defense.
