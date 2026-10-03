# FoodRescue — Architecture

## 1. Overview
FoodRescue is a Vite monorepo with an Ionic React frontend serving two experiences from one app shell:
- **User module** — mobile-first, used by students/donors/claimants (Capacitor build + PWA on phones).
- **Admin module** — same codebase, styled and routed for desktop/web use (staff moderation, analytics).

The frontend talks directly to **Supabase** (Postgres + Auth + Storage) through `supabase-js`, secured by **Row Level Security (RLS)**. A small Express TypeScript service also exists under `apps/backend` and currently provides the health endpoint used to verify the backend deployment.

## 2. High-Level Diagram

```
┌───────────────────────────────────────────────────────────┐
│                  IONIC REACT APP (single repo)              │
│                                                             │
│   /app/*  (mobile, React dock)   /admin/*  (web, admin layout)│
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
         CSS-based campus map prototype in `MapPage.jsx`
```

## 3. Client Layer
| Concern | Choice |
|---|---|
| Framework | React 18 + Ionic React |
| Mobile packaging | Capacitor (Android/iOS) |
| Admin packaging | Same build, deployed as static PWA/web app |
| State/data access | React hooks and plain JavaScript service modules |
| Maps | CSS-based campus map prototype in `MapPage.jsx` |
| Notifications | Claim feedback banners and local pickup events; push messaging is not implemented |
| Styling | Tailwind utility classes, `styles.css`, and selected Ionic primitives |

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
| Backend | Express health service plus Supabase database/Auth/Storage |
| Images | Supabase Storage, public-read bucket for post photos |

**Recommended for this project:** Option A — single deployment, one PWA bundle, role-based redirect after login. Simpler to build, run, and demo than maintaining two separate bundles.

## 7. Key Architectural Decisions
1. **Supabase-first data access** — the frontend uses `supabase-js` for authenticated CRUD and the Express service remains a small health/API boundary.
2. **Security lives in the database (RLS)**, not just in app code — prevents a student from bypassing rules by editing client code.
3. **Atomic quantity decrement via Postgres RPC function**, not app-side read-then-write, to prevent race conditions when multiple users claim the same post simultaneously.
4. **Realtime subscriptions** replace the need for Socket.io — Supabase pushes DB changes directly to subscribed clients.
5. **One Ionic React codebase** for both user and admin, differentiated by route guards and layout components, reducing duplication of auth/services code.

## 8. Actual Source Locations
| Concern | Repository location |
|---|---|
| React entry point and Ionic app shell | `apps/frontend/src/main.jsx` |
| Routes and guards | `apps/frontend/src/App.jsx`, `apps/frontend/src/guards/` |
| User screens | `apps/frontend/src/components/` |
| Login/register screens | `apps/frontend/src/modules/auth/` |
| Reusable UI effects | `apps/frontend/src/components/ui/calamansi/` |
| Supabase client and data services | `apps/frontend/src/services/` |
| Shared TypeScript interfaces | `packages/shared/src/index.ts` |
| Express server and health route | `apps/backend/src/` |
| Database schema, RLS, and RPC | `supabase/migrations/` |
