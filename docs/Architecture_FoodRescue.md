# FoodRescue — Architecture

See [Design Agreement](Design_Agreement_FoodRescue.md) for the confirmed target and [Rubric Audit](Rubric_Audit.md) for current evidence.

## Target delivery
One Ionic React/Vite codebase delivers an Android APK for donor/claimant use through Capacitor and a desktop web admin experience. Member routes remain /app/*; admin routes /admin/*; shared auth uses /login and registration. AuthGuard/RoleGuard provide navigation protection, while server authorization is the security boundary.

Supabase supplies Auth, Postgres, Storage, atomic RPC operations, and shared updates. The existing Express TypeScript service remains a health/API boundary. No replacement backend is required by the interview.

## Required capabilities
- Persisted donor/claimant lifecycle and history, rather than local-only claim passes.
- Atomic reservations, cancellation decisions/releases, QR/manual pickup authorization, strict server-time deadlines, and audited moderation.
- Interactive donor-selected pickup pins and consented foreground claimant location sharing. Map-provider selection remains an implementation decision.
- Real photo Storage upload with agreed limits.
- Shared in-app notifications and donor-only latest journey coordinates.
- Android camera/location permission handling and real-device validation.

## Deferred capabilities
SMS provider selection and integration are deferred; intended Edge Function events are acceptance and On my way to Philippine recipients, with in-app fallback on failure. Background tracking, bans, broadcasts, and advanced analytics are deferred. Push delivery and distance sorting are not confirmed defense requirements.

## Existing source and gaps
| Concern | Current location |
|---|---|
| Entry / routes | apps/frontend/src/main.jsx, App.jsx |
| Screens | apps/frontend/src/components |
| Auth / admin | apps/frontend/src/modules |
| Guards | apps/frontend/src/guards |
| Data services | apps/frontend/src/services |
| Shared types | packages/shared/src/index.ts |
| Health service | apps/backend/src |
| Schema / RPC / RLS | supabase/migrations |

Current MapPage is a CSS prototype. Current food.js still stores local claim passes and local pickup completion even after a configured claim RPC. Existing SQL/types lack new lifecycle and verification data. These are implementation gaps, not approved substitutes.

## Deployment evidence
Build and install the APK on test phones, deploy the web admin, and use separate real Supabase accounts. Verify shared results from another account, camera scanning, GPS denial/stale updates, upload failures, strict cutoff, replay prevention, and moderation auditing. No live deployment or device result is asserted by this design document.
