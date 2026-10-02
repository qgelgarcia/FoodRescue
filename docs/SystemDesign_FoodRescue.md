# FoodRescue — System Design

## 1. Actors
- **Student** — can post food, claim food, receive notifications.
- **Org/Provider** — same permissions as student, typically posts larger quantities.
- **Admin** — moderates users, posts, reports; has no posting/claiming role by default.
- **System (scheduled jobs)** — expires posts, sends reminders.

## 2. Core Modules
```
Auth Module ──┬── User Module ──┬── Home Feed
              │                 ├── Map View
              │                 ├── Create Post
              │                 ├── My Posts
              │                 ├── Claim Food
              │                 ├── My Claims
              │                 ├── Notifications
              │                 └── History / Profile
              │
              └── Admin Module ─┬── Dashboard
                                ├── User Management
                                ├── Post Moderation
                                ├── Reports Queue
                                ├── Claims Monitor
                                ├── Broadcast
                                └── Activity Logs
```

## 3. Data Flow: Creating a Post
```
Donor fills form
   → uploads photo to Supabase Storage (food-photos bucket)
   → gets public URL
   → inserts row into food_posts (status='active')
   → RLS policy checks donor_id = auth.uid()
   → Realtime broadcasts INSERT to subscribed feed clients
   → nearby users' feeds update live / receive push notification
```

## 4. Data Flow: Claiming Food (Race-Condition-Safe)
```
Claimant taps "Claim", enters qty
   → client calls supabase.rpc('claim_food', { post_id, claimant_id, qty })
   → Postgres function (SECURITY DEFINER):
        1. UPDATE food_posts SET quantity_remaining -= qty
           WHERE id = post_id AND quantity_remaining >= qty
        2. IF no row updated → raise exception "not enough remaining"
        3. INSERT INTO claims (...)
   → transaction commits atomically (single DB transaction)
   → Realtime pushes updated quantity_remaining to all viewers
   → notification inserted for donor (claim_received)
```
This design guarantees no two simultaneous claims can oversell the same post, because the `UPDATE ... WHERE quantity_remaining >= qty` clause fails safely under concurrent access without needing app-level locks.

## 5. Data Flow: Post Expiration (Scheduled)
```
pg_cron job runs every 5 minutes:
   UPDATE food_posts SET status = 'expired'
   WHERE status = 'active' AND expires_at < now();
   → Realtime pushes UPDATE → feeds drop expired posts automatically
```

## 6. Data Flow: Admin Moderation
```
Admin opens Post Moderation
   → RLS "admin_full_access_posts" policy grants full read/write
   → Admin removes a violating post
       → UPDATE food_posts SET status = 'removed_by_admin'
       → INSERT INTO admin_logs (admin_id, action, target_id)
   → Realtime pushes update; post disappears from user feeds
```

## 7. Sequence Diagram — Full Claim Lifecycle
```
Claimant        App (Ionic)         Supabase (RPC)        Postgres           Donor
   |                |                     |                   |                |
   |--tap Claim---->|                     |                   |                |
   |                |--rpc claim_food()-->|                   |                |
   |                |                     |--atomic UPDATE---->|                |
   |                |                     |--INSERT claim----->|                |
   |                |<--success-----------|                   |                |
   |<--claim pending|                     |                   |                |
   |                |                     |--Realtime push------------------->|
   |                |                     |                   |   claim_received notif
   |                |                                                          |--Accept-->|
   |                |<----------------------- Realtime push (claim accepted)---|
   |<--notified-----|                     |                   |                |
   |--(pickup in person)---------------------------------------------------->|
   |                |                                                          |--mark picked_up-->|
   |                |<----------------------- Realtime push (status=picked_up)-|
```

## 8. Non-Functional Design Considerations
- **Indexing:** index `food_posts(status, expires_at)` and `food_posts(pickup_lat, pickup_lng)` for feed queries; index `claims(post_id)` and `claims(claimant_id)`.
- **Geo-sorting:** for v1, distance sort can be computed client-side with the Haversine formula on lat/lng pulled from active posts (small dataset for a campus scope); PostGIS is a future upgrade if scale demands it.
- **Security boundary:** RLS is the actual enforcement layer; client-side route guards are UX convenience only.
- **Failure handling:** `claim_food` RPC raises an exception on insufficient quantity, which the client catches and shows as "Sorry, this was just claimed by someone else."

## 9. Component Responsibility Matrix
| Component | Responsibility |
|---|---|
| `supabase.service.ts` | Initializes client, exposes auth session observable |
| `posts.service.ts` | CRUD for `food_posts`, subscribes to Realtime channel |
| `claims.service.ts` | Calls `claim_food` RPC, manages claim status updates |
| `notifications.service.ts` | Reads/writes `notifications`, marks read |
| `admin.service.ts` | Admin-only queries (users, reports, logs, broadcast) |
| `RoleGuard` | Blocks non-admins from `/admin/*` routes client-side |
| `AuthGuard` | Blocks unauthenticated access to any protected route |
