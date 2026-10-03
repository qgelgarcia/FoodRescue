# FoodRescue — Build Prompt (for Antigravity)

Copy the block below into Antigravity as your project instruction. It references the other seven companion files — keep them in the same workspace/repo root so the agent can read them for detail as needed.

---

```
You are building "FoodRescue" — a mobile surplus food sharing and claiming app,
with a web-facing admin panel built from the SAME Ionic React codebase.

CONTEXT FILES (read these first, in this order, before writing any code):
1. Specs_FoodRescue.md        — functional & non-functional requirements
2. Architecture_FoodRescue.md — overall system architecture and tech stack
3. SystemDesign_FoodRescue.md — data flows, sequence diagrams, module responsibilities
4. Database_FoodRescue.md     — full Postgres/Supabase schema, RLS policies, RPC functions
5. Rules_FoodRescue.md        — business, security, and validation rules to enforce
6. Walkthrough_FoodRescue.md  — expected user/admin journeys, for UX reference
7. Phases_FoodRescue.md       — the build order to follow

STACK (do not substitute unless asked):
- Frontend: Ionic React + Vite + React Router
- Backend: Supabase (Postgres, Auth, Storage, RPC) plus the Express TypeScript health service in `apps/backend`
- Maps: CSS-based campus map prototype in `apps/frontend/src/components/MapPage.jsx`
- Notifications: in-app claim/pickup feedback; push notifications are a future phase
- Data access: `supabase-js` client called directly from React service modules; authorization enforced via Postgres Row Level Security, not just client-side guards

PROJECT STRUCTURE TO CREATE:
foodrescue-app/
  apps/frontend/src/components/  (user screens, shared components, UI effects)
  apps/frontend/src/modules/     (auth and admin modules)
  apps/frontend/src/guards/      (AuthGuard.jsx, RoleGuard.jsx)
  apps/frontend/src/services/    (supabase.js, auth.js, food.js)
  apps/frontend/src/styles.css   (theme tokens and shared styles)
  apps/backend/src/              (Express server and health route)
  packages/shared/src/            (TypeScript domain interfaces)
  supabase/migrations/            (schema, RLS, RPC, and storage policies)

ROUTING RULES:
- "/login" is shared.
- "/app/*" is the mobile-first module, guarded by AuthGuard, and uses the React floating dock.
- "/admin/*" is the admin module, guarded by AuthGuard + RoleGuard (role must equal 'admin'),
  uses ion-split-pane + ion-menu for desktop-style navigation.
- After login, check profiles.role: 'admin' -> redirect to /admin/dashboard,
  everyone else -> redirect to /app/home-feed.

BUILD ORDER — follow Phases_FoodRescue.md exactly, phase by phase. Do not skip ahead to
admin screens before the core user posting/claiming flow works end-to-end. After each
phase, pause and summarize what was built and what still needs manual verification
(e.g. "please create a test admin user in Supabase and confirm /admin routes redirect
correctly for non-admins").

NON-NEGOTIABLE IMPLEMENTATION DETAILS:
1. Quantity decrements on claiming MUST go through the `claim_food` Postgres RPC function
   exactly as defined in Database_FoodRescue.md — never decrement quantity_remaining via a
   direct client-side UPDATE call. This prevents overselling under concurrent claims.
2. Row Level Security policies must be created exactly as specified in Database_FoodRescue.md
   for every table before any frontend screen that touches that table is considered "done."
   Client-side route guards are a UX nicety, not the security boundary — RLS is.
3. Post expiration is handled by the pg_cron scheduled job, not by client-side date filtering
   alone. The feed's "is this post still active" check should always rely on the `status`
   column, which the cron job keeps in sync with `expires_at`.
4. Use Supabase Realtime (postgres_changes) subscriptions on `food_posts` and `claims` when
   the live-data phase is implemented; the current demo uses local claim events.
5. All admin actions that change another user's/post's state (ban, remove post, resolve
   report) must write a row to `admin_logs` in the same operation.
6. Enforce every rule listed in Rules_FoodRescue.md — treat that file as the acceptance
   criteria for business logic and validation, in addition to Specs_FoodRescue.md.

DELIVERABLE PER PHASE:
- Working code for that phase's scope only.
- Any new SQL (tables/policies/functions) needed for that phase, written as a runnable
  migration file.
- A short list of manual steps I need to do in the Supabase dashboard (if any), and how to
  test the phase is working before moving to the next one.

Start with Phase 0 and Phase 1 from Phases_FoodRescue.md: project setup, Supabase schema
creation, RLS policies, and the auth module with role-based redirect. Confirm this is
working before proceeding to Phase 2.
```

---

## Tips for using this in Antigravity
- Keep all 8 `*_FoodRescue.md` files in the project root/workspace so the agent can open and re-reference them mid-task rather than relying only on what's pasted above.
- If Antigravity lets you attach files to context, attach `Database_FoodRescue.md` and `Rules_FoodRescue.md` specifically whenever you ask it to touch schema, RLS, or claim logic — those two are the ones most likely to get "simplified away" if not kept in view.
- After each phase, ask the agent to output the exact SQL it expects you to run in the Supabase SQL editor, rather than assuming it ran migrations for you — Antigravity's execution environment may not have direct DB access depending on your setup.
