# Project Map

## Purpose
Campus surplus food listings and portion claims.

## Requirements
Teach the whole existing system, including frontend engineering. No application edits requested.

## Components
- Root package.json: npm workspaces and development/build/test commands.
- apps/frontend/src/main.jsx: React root, Ionic app and router, CSS imports.
- apps/frontend/src/App.jsx: public auth routes, role-protected admin routes, authenticated member routes and animated navigation.
- apps/frontend/src/modules: auth/admin and member feed, post, map, history, profile pages.
- apps/frontend/src/components: auth inputs/confirmation, food card/preview, shared layout/background, visual primitives.
- apps/frontend/src/components/ui/calamansi and src/lib: visual primitives, animation/shape utilities and validation.
- apps/frontend/src/services/auth.js: Supabase authentication/profile operations or browser-local demo identity.
- apps/frontend/src/services/food.js: direct Supabase reads, inserts and claim_food RPC; local demo listings, inventory and claim history.
- apps/backend/src/index.ts and routes/health.routes.ts: Express server, CORS, health endpoint; no food REST routes registered.
- packages/shared/src/index.ts: TypeScript domain/API contracts; frontend is JSX and does not automatically enforce these types.
- supabase/migrations: tables, policies, auth triggers, storage policies and atomic claiming function.
- docs and CONTEXT.md: intended requirements and decisions, which must be compared with implementation.

## Main Flow
Browser -> main.jsx -> App.jsx -> auth/role guard -> page -> service -> Supabase or localStorage.
FoodCard -> claimFoodPost -> optional database RPC -> local claim/inventory writes -> custom browser event.
Separate Express process -> /api/health.

## Data and Trust Boundaries
Supabase authentication and PostgreSQL RLS govern remote access; route guards control client navigation.
Demo identity and claims are browser-local data.
Latest checked claim RPC decrements available inventory conditionally and inserts a pending claim in one database function.
Frontend creates a separate local ready_for_pickup record after claiming. These statuses differ.

## Build and Deployment
Root npm run dev starts frontend and backend; npm run build builds workspaces; npm test targets frontend validation tests.
Vite uses React and Tailwind plugins, @ alias, port 5173.
Frontend build and 11 Node tests passed October 16, 2026; no running deployment verified.

## Unknowns
Learner familiarity and experience; actual deployed database migration state; runtime behavior not tested.
Further detailed component, CSS, schema and documentation walkthroughs remain.
MapPage now uses Leaflet/OpenStreetMap, category markers, optional user location and a distance radius. Actual positioning and tile availability are not browser-verified in this session; admin logic still uses demo arrays.
PostPage uses object URLs for selected image previews and passes its first URL to the service; no persistent upload in that inspected path.
