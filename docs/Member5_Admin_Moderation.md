# Member 5 — Live admin, reports, and audit

## What is implemented

- Admin dashboard, member list, post moderation, claims, reports, and audit log load from server-checked Supabase RPCs. Admin post and claim views omit pickup coordinates and pickup codes.
- Admins can suspend/reactivate members and remove listings with a required explanation. Each operation and its audit row are written in one database transaction.
- Suspended accounts cannot publish or claim. They can still submit reports and complete pickups already in progress.
- Members can report a listing or its donor, view only their own report statuses, and see the resolution explanation. Admins move reports from `open` to `reviewed` to `resolved`; resolution requires an explanation.
- Listing removal rejects pending claims, cancels accepted claims, invalidates pickup passes, clears the listing coordinates, notifies the donor and claimants, and preserves completed pickup history.
- Members can view and mark their own moderation notifications as read from the signed-in header.
- Direct client writes to reports, audit logs, claims, and moderation fields are denied. Admin RPCs independently verify the signed-in account's active admin role.
- The report queue filters by status, target type, and date; it searches reporter, target, and explanation, and defaults to open-first/oldest-first. Each report has a safe context panel without pickup coordinates or codes.
- Post moderation flags active listings nearing or past expiry and listings missing a description. These are review prompts, not food-safety certification.
- The dashboard links to unresolved reports and listings needing attention. Audit logs can be searched by text/date and exported as CSV (latest 200 records).

## Apply and deploy

1. Link the Supabase CLI to the intended project, then run `npx supabase db push` from the repository root. This applies the moderation migration and the follow-up triage migration in `supabase/migrations/`.
2. Configure the frontend with `VITE_SUPABASE_URL` and the project's public anon key (for local desktop use, put these in `apps/frontend/.env.local`). Never put a service-role key in frontend configuration or source control.
3. From the repository root, run `npm ci` and `npm run build:frontend`. Deploy `apps/frontend/dist` to a static host and configure SPA fallback so unknown paths serve `index.html`. Admin and member screens are part of this same frontend; no separate admin bundle is required.
4. Run the local desktop app with `npm run dev:frontend`; Vite serves it at `http://127.0.0.1:5173` by default.

The migration has to be applied before the new RPC-backed screens can load. For production, deploy the database migration first, then publish the frontend. The frontend anon key is browser-visible by design; access control comes from RLS and server-side RPC checks.

## Provision an admin safely

Create the account through the normal sign-up flow and confirm its email. In the Supabase SQL Editor, verify the exact auth account exists, then promote only that account using the trusted SQL editor (never from the browser):

```sql
begin;
with promoted as (
  update public.profiles p
  set role = 'admin', status = 'active'
  from auth.users u
  where p.id = u.id
    and lower(u.email) = lower('admin@example.edu')
  returning p.id
)
insert into public.admin_logs (admin_id, actor_name, action, target_type, target_id, details)
select null, current_user, 'admin_provisioned', 'user', id,
       jsonb_build_object('reason', 'Trusted initial admin provisioning')
from promoted;
commit;

select u.id, u.email, p.role, p.status
from auth.users u join public.profiles p on p.id = u.id
where lower(u.email) = lower('admin@example.edu');
```

Replace the example email with the intended account and verify the affected profile afterward. The transaction also records the trusted initial provisioning in the audit log; if the account is not found, no row is promoted or logged. Keep the SQL editor and service-role credentials restricted to trusted project owners. Admin accounts cannot be suspended through the member-management screen.

## Report-to-action demonstration

Use two confirmed accounts, one ordinary member and one admin, and an existing active listing.

1. As the member, open the listing, choose **Report this listing** (or **Report donor**), enter a factual explanation of at least 10 characters, and submit. Open **My Reports** to show the new `open` report.
2. Sign in as the admin and open **Reports Queue**. Mark the report reviewed. If the report warrants action, open **Post Moderation** and remove the related listing with a separate explanation.
3. Open **Audit Log**. Show the report transition and, if performed, listing removal with the admin actor, target, explanation, and timestamp.
4. Return to the member account. **My Reports** should show the updated status and resolution explanation after the admin resolves it.
5. For the suspension check, use a test member with an existing pickup: suspend them, confirm new posting/claiming is refused, submit a report, and finish the existing pickup. Reactivate the test account afterward.

## Verification boundaries

The implementation creates the migration and frontend operations, but does not apply them to a remote Supabase project. Remote RLS behavior, email confirmation, hosting routes, and the complete two-account demo must be verified in the target deployment after applying the migration.
