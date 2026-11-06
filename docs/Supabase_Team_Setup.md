# FoodRescue — Shared Supabase setup

## Configured project

- Project URL: https://tbmmqimhhazbuazetdwa.supabase.co
- Project reference: tbmmqimhhazbuazetdwa
- Dashboard: https://supabase.com/dashboard/project/tbmmqimhhazbuazetdwa
- Copyable client configuration: [Supabase_Team.env.example](Supabase_Team.env.example).

These values were read from the existing frontend environment file. The key was checked to have the legacy anon role, not service_role. Hosted reachability, key validity, deployed schema and team access have not been verified. This package configures the existing project; it does not create a new database or grant dashboard access.

## Each teammate's app setup

1. Obtain the project source and install dependencies with npm install from the repository root.
2. Copy Supabase_Team.env.example into apps/frontend/.env. If that file already exists, update only the two Supabase variables and preserve other settings.
3. Run npm run dev:frontend and restart the dev server after environment changes.
4. Register a separate real app account for each tester; use distinct donor and claimant accounts for shared-flow checks. App admin accounts must be provisioned by the authorized project owner rather than public registration.
5. Use the same configured project in the Android build. Do not use desktop localhost as the phone's hosted Supabase URL.

The client anon key is designed for client use with authentication and RLS; it is not a dashboard login, direct database password, or admin account. Do not substitute a service-role/secret key into VITE variables. Supabase's [API-key documentation](https://supabase.com/docs/guides/getting-started/api-keys) distinguishes client keys from privileged server keys.

## Dashboard and database work

The project owner should invite teammates through the Supabase organization's team settings, using individual Supabase accounts and suitable available roles. Do not distribute the owner's login. See [Supabase access control](https://supabase.com/docs/guides/platform/access-control).

Member 1 coordinates schema changes; Members 2–5 submit owned migrations through the agreed review/integration process. Organization/dashboard permissions are separate from FoodRescue's student/org/provider/admin roles.

Direct SQL connection credentials and the database password are not included. If direct access is needed, the authorized owner obtains the connection details from the dashboard and shares the necessary secrets privately with the relevant database maintainer. Service-role keys, database passwords, personal access tokens and SMS credentials do not belong in the team client file or frontend build.

## Schema source and deployment status

Existing baseline migrations, in order:

1. ../supabase/migrations/20260927000000_initial_schema.sql
2. ../supabase/migrations/20260927000001_fix_profiles_rls_recursion.sql
3. ../supabase/migrations/20260927000002_create_storage_bucket.sql
4. ../supabase/migrations/20260927000003_allow_insert_own_profile.sql
5. ../supabase/migrations/20261003000000_harden_auth_and_claims.sql

These paths are relative to this document. Baseline migrations do not implement the full confirmed design. Do not manually rerun them on the shared hosted database without checking its migration history. The database maintainer must inspect applied migrations, review pending SQL, confirm the target project, then deploy through the coordinated process. No migrations were applied while preparing this sharing package.

Target changes are described in [Database design](Database_FoodRescue.md); implementation gaps are in [Rubric audit](Rubric_Audit.md); ownership is in [Team tasks](Team_Tasks_FoodRescue.md).

## Shared verification

Use separate accounts to check that a real post appears across devices, claims use persisted database records, and non-owner/non-admin actions are rejected server-side. An empty/error live feed falling back to demo posts is not proof of a healthy connection. The current prototype still has documented gaps; sharing its client key does not resolve them.
