# FoodRescue — Architecture

## 1. Overview
FoodRescue is a single Ionic (Angular) codebase serving two experiences from one app shell:
- **User module** — mobile-first, used by students/donors/claimants (Capacitor build + PWA on phones).
- **Admin module** — same codebase, styled and routed for desktop/web use (staff moderation, analytics).

Both modules talk to the same **Supabase** backend (Postgres + Auth + Realtime + Storage + Edge Functions/Cron). There is no separate custom REST API server — Supabase's client library (`supabase-js`) is called directly from the frontend, secured by **Row Level Security (RLS)** at the database layer.

## 2. High-Level Diagram

```
┌───────────────────────────────────────────────────────────┐
│                     IONIC APP (single repo)                │
│                                                             │
│   /app/*  (mobile, ion-tabs)     /admin/*  (web, split-pane)│
│   Home Feed, Map, Create Post,   Dashboard, Users, Posts,   │
│   My Posts, Claims, Notifs,      Reports, Broadcast, Logs   │
│   Profile                                                   │
└───────────────────────────┬─────────────────────────────────┘
                            │  supabase-js client (HTTPS)
                            ▼
                ┌─────────────────────────┐
                │        SUPABASE          │
                │  Auth (JWT, roles)       │
                │  Postgres DB + RLS       │
                │  Realtime (channels)     │
                │  Storage (food photos)   │
                │  Edge Functions / Cron   │
                │   - claim_food() RPC     │
                │   - expire posts job     │
                │   - notification triggers│
                └─────────────────────────┘
                            +
        OpenStreetMap / Leaflet.js (map rendering)
        Firebase Cloud Messaging (push notifications)
```

## 3. Client Layer
| Concern | Choice |
|---|---|
| Framework | Ionic + Angular |
| Mobile packaging | Capacitor (Android/iOS) |
| Admin packaging | Same build, deployed as static PWA/web app |
| State/data access | `supabase-js` via injectable Angular services |
| Maps | Leaflet.js + OpenStreetMap tiles |
| Push notifications | Firebase Cloud Messaging (mobile only) |
| Styling | Ionic components; `ion-tabs` for mobile nav, `ion-split-pane` + `ion-menu` for admin nav |

## 4. Backend Layer (Supabase)
| Concern | Choice |
|---|---|
| Database | Postgres |
| Auth | Supabase Auth (email/password; JWT issued per session) |
| Authorization | Row Level Security policies per table, role stored in `profiles.role` |
| Realtime | Postgres Changes subscriptions on `food_posts` and `claims` |
| File storage | Supabase Storage bucket `food-photos` |
| Server-side logic | Postgres functions (RPC) for atomic operations (e.g. `claim_food`) |
| Scheduled jobs | `pg_cron` for auto-expiring posts |

## 5. Routing Split (one app, two experiences)
```
/login                → shared auth screen
/app/*                → user module (mobile-first)
/admin/*              → admin module (web-first), guarded by RoleGuard
```
- `AuthGuard` — blocks unauthenticated access to both `/app/*` and `/admin/*`.
- `RoleGuard` — restricts `/admin/*` to users with `profiles.role = 'admin'`, enforced both client-side (UX) and server-side (RLS, real security boundary).

## 6. Deployment Model
| Component | Deployment |
|---|---|
| Mobile app | Capacitor build → Google Play / App Store, or installed as PWA |
| Admin panel | Same repo build, deployed as a static site (Netlify/Vercel/Firebase Hosting) reachable via browser |
| Backend | Fully managed by Supabase (no server to provision) |
| Images | Supabase Storage, public-read bucket for post photos |

**Recommended for this project:** Option A — single deployment, one PWA bundle, role-based redirect after login. Simpler to build, run, and demo than maintaining two separate bundles.

## 7. Key Architectural Decisions
1. **No custom backend server** — Supabase replaces Express/API layer entirely; less infra to maintain for a student project.
2. **Security lives in the database (RLS)**, not just in app code — prevents a student from bypassing rules by editing client code.
3. **Atomic quantity decrement via Postgres RPC function**, not app-side read-then-write, to prevent race conditions when multiple users claim the same post simultaneously.
4. **Realtime subscriptions** replace the need for Socket.io — Supabase pushes DB changes directly to subscribed clients.
5. **One Ionic codebase** for both user and admin, differentiated by route module and layout component (tabs vs. split-pane), reducing duplication of auth/services code.
