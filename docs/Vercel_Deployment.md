# FoodRescue Vercel deployment

The repository root is the Vercel project root. Root vercel.json explicitly installs build-time dev dependencies even under NODE_ENV=production and builds apps/frontend with Vite and serves apps/frontend/dist. api/[...path].ts exposes the Express backend under /api on the same origin. Non-API browser routes fall back to index.html. Vercel imports do not start a local listener or an interval worker.

Project: foodrescue, LS-Customs. Production domain: https://foodrescue-three.vercel.app.

Server-only production environment variables are encrypted in Vercel: Supabase URL/anon/service-role configuration, OpenRouter key and exact model, Gmail sender/app password, email enablement, public app URL, allowed origin, and EMAIL_DISPATCH_SECRET. Only VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and VITE_API_BASE_URL=/api are exposed to the browser. The service-role key, AI key and Gmail app password are never VITE variables. Local credential files, output, Android sources and account/project metadata are excluded from upload by .vercelignore. .vercel is ignored by Git.

The chatbot is locked to nvidia/nemotron-3.5-lightning:free, with zero input/output/per-request prices and no model fallback. Zero retention and no provider data collection remain enabled by explicit owner choice. The model is currently unavailable under that privacy policy, so the app reports unavailability instead of switching models.

## Scheduled email delivery

Migration 20261031020000_vercel_email_scheduler.sql enables pg_net and Vault and schedules a minute-by-minute call to public.dispatch_email_queue(). It makes no HTTP request until both Vault values exist:

- foodrescue_email_dispatch_url: the HTTPS production /api/internal/email-dispatch URL.
- foodrescue_email_dispatch_secret: the same generated secret stored in Vercel EMAIL_DISPATCH_SECRET.

Only service_role can invoke the dispatcher; browsers cannot read its Vault secrets or call the protected endpoint. Every call requires the shared bearer secret. The worker leases jobs atomically, retains SMTP uncertain-delivery protection, and finishes within the configured Vercel function duration. No frequent Vercel Cron plan upgrade is needed.

## Authentication redirects

Supabase Auth Site URL should be https://foodrescue-three.vercel.app. Additional allowed redirects should include https://foodrescue-three.vercel.app/** and existing localhost development addresses. This configuration requires a Supabase management session; the database password and service-role key cannot change the hosted Auth service configuration. Verify Google sign-in and password-reset emails against the production domain before inviting users.

## Validation and operation

Run npm test, npm run lint, the backend type check, and the frontend build. The serverless regression tests cover health routing, chat auth, scheduler authentication, scheduler Vault setup, and prohibited dispatch destinations. After deployment check /api/health, app route fallback, unauthenticated chat denial, and scheduler denial without its secret. Check Supabase cron.job_run_details and net._http_response for scheduled runs. Do not log authorization headers or passwords.

Deploy from the repository root with the official Vercel CLI. Store production secrets through Vercel environment settings, never as deployment source or command-line values. No APK is built by this web deployment.
