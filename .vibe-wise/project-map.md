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
- apps/frontend/src/services/food.js: Supabase listing reads/writes and pending claim submission; shared claimant history. Sample listings are read-only previews for claiming.
- apps/frontend/src/services/claims.js: donor decisions, cancellation requests/decisions and donor pickup-verification RPC calls.
- apps/frontend/src/components/claims and modules/history/HistoryPage.jsx: My Claims, Donor Requests, QR display/scanner, manual verification and cancellation forms.
- apps/backend/src/index.ts and routes/health.routes.ts: Express server, CORS, health endpoint; no food REST routes registered.
- packages/shared/src/index.ts: TypeScript domain/API contracts; frontend is JSX and does not automatically enforce these types.
- supabase/migrations: tables, policies, auth triggers, storage policies and atomic claiming function.
- docs and CONTEXT.md: intended requirements and decisions, which must be compared with implementation.

## Main Flow
Browser -> main.jsx -> App.jsx -> auth/role guard -> page -> service -> Supabase or localStorage.
FoodCard -> claimFoodPost -> claim_food RPC -> pending database claim and reserved inventory -> custom browser event.
HistoryPage -> claims service -> donor decision/cancellation/verification RPC -> persisted state and notifications -> screen refresh.
Separate Express process -> /api/health.

## Data and Trust Boundaries
Supabase authentication and PostgreSQL RLS govern remote access; route guards control client navigation.
Demo identity and claims are browser-local data.
Claim RPC reserves inventory atomically and creates a pending claim. Acceptance authorizes pickup without reserving again. Donor-only verification consumes a single-use token and confirms full-quantity pickup.
Cancellation is a separate retained request: approval cancels/releases once; denial preserves claim state. Verification pauses for the particular claim while cancellation is pending.
October 22 migration enforces ownership, membership, eligibility and deadlines server-side. No scheduled expiration worker was added; claim views project overdue pending/accepted states.

## Build and Deployment
Root npm run dev starts frontend and backend; npm run build builds workspaces; npm test targets frontend validation tests.
Vite uses React and Tailwind plugins, @ alias, port 5173.
Frontend build and 11 Node tests passed October 16, 2026; no running deployment verified.

## Unknowns
Learner familiarity and experience; actual deployed database migration state; runtime behavior not tested.
Further detailed component, CSS, schema and documentation walkthroughs remain.
MapPage uses Leaflet/OpenStreetMap, category markers, optional user location and a distance radius. Admin moderation uses database RPCs. Physical QR-camera behavior remains unverified; prior claim-workflow implementation testing passed locally and remotely, but no tests were rerun for this explanation.
PostPage uses object URLs for selected image previews and passes its first URL to the service; no persistent upload in that inspected path.
