# FoodRescue Vercel deployment

The repository root is the Vercel project root. Root vercel.json explicitly installs build-time dev dependencies even under NODE_ENV=production and builds apps/frontend with Vite and serves apps/frontend/dist. api/index.ts exposes the Express backend under /api on the same origin. Non-API browser routes fall back to index.html. Vercel imports do not start a local listener or an interval worker.

Project: foodrescue, LS-Customs. Production domain: https://foodrescue-three.vercel.app.

Server-only production environment variables are encrypted in Vercel: Supabase URL/anon/service-role configuration, OpenRouter key and exact model, Gmail sender/app password, email enablement, public app URL, allowed origin, and EMAIL_DISPATCH_SECRET. Only VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and VITE_API_BASE_URL=/api are exposed to the browser. The service-role key, AI key and Gmail app password are never VITE variables. Local credential files, output, Android sources and account/project metadata are excluded from upload by .vercelignore. .vercel is ignored by Git.

The chatbot is locked to nvidia/nemotron-3.5-lightning:free, with zero input/output/per-request prices and no model fallback. Zero retention and no provider data collection remain enabled by explicit owner choice. The model is currently unavailable under that privacy policy, so the app reports unavailability instead of switching models.

## Scheduled email delivery

Migration 20261031020000_vercel_email_scheduler.sql enables pg_net and Vault and schedules a minute-by-minute call to public.dispatch_email_queue(). It makes no HTTP request until both Vault values exist:

- foodrescue_email_dispatch_url: the HTTPS production /api/internal/email-dispatch URL.
- foodrescue_email_dispatch_secret: the same generated secret stored in Vercel EMAIL_DISPATCH_SECRET.

Only service_role can invoke the dispatcher. Vault secrets are unavailable to client roles. Activation also verifies that the hosted net schema is excluded from the browser Data API and that client roles cannot log in to Postgres directly; platform-owned pg_net SQL grants are not assumed to be revocable by the project database role. Every call requires the shared bearer secret. The worker leases jobs atomically, retains SMTP uncertain-delivery protection, and finishes within the configured Vercel function duration. No frequent Vercel Cron plan upgrade is needed.

## Authentication redirects

Supabase Auth Site URL should be https://foodrescue-three.vercel.app. Additional allowed redirects should include https://foodrescue-three.vercel.app/** and existing localhost development addresses. This configuration requires a Supabase management session; the database password and service-role key cannot change the hosted Auth service configuration. Verify Google sign-in and password-reset emails against the production domain before inviting users.

## Validation and operation

Run npm test, npm run lint, the backend type check, and the frontend build. The serverless regression tests cover health routing, chat auth, scheduler authentication, scheduler Vault setup, and prohibited dispatch destinations. After deployment check /api/health, app route fallback, unauthenticated chat denial, and scheduler denial without its secret. Check Supabase cron.job_run_details and net._http_response for scheduled runs. Do not log authorization headers or passwords.

Deploy from the repository root with the official Vercel CLI. Store production secrets through Vercel environment settings, never as deployment source or command-line values. No APK is built by this web deployment.


## Production acceptance (2026-10-31)

Public app routes and /api/health return HTTP 200. Nested unauthenticated chat and email-dispatch requests return HTTP 401. Supabase Auth Site URL and redirect allowlist were updated through a reviewed two-field configuration diff; a subsequent diff had zero changes. Existing localhost redirects were preserved.

Supabase email Cron is active every minute. Its existing scheduled request to the production endpoint returned HTTP 200 without timeout; the email outbox was empty at verification. No synthetic pickup was created. The live UI is verified at the public sign-in page; a full user sign-in and pickup-to-email workflow is not claimed by these smoke checks.

The final suite passes 105 tests. Build tools are explicitly included during production installation. Development-only demo-account shortcuts are hidden from production. Exact NVIDIA model availability remains blocked by its current zero-retention routing, as accepted by the owner. No paid model or privacy downgrade is used.
