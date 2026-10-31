# Email notifications

The localhost app exposes email preferences in Profile. Claims and pickup decisions notify the donor and claimant; donor copies include the recipient name and portions. A donor-confirmed handover creates a pickup receipt for both parties. Receipts are not invoices or tax documents. QR codes, passwords, recipient email addresses and phone numbers are never included in the message body.

Nearby-food alerts require explicit opt-in, a saved alert location, and a radius of 500 m to 5 km. The location is separate from pickup journey sharing and does not use background tracking. Switching nearby alerts off and saving removes that saved point. The sender rechecks preferences, radius, food availability, account eligibility and verified Auth email before dispatch. Changing an email address prevents pending retries from going to the old mailbox. Existing data is not backfilled into emails.

## Gmail setup

1. Enable Google 2-Step Verification for the actual sending account.
2. Create an app password named FoodRescue at https://myaccount.google.com/apppasswords.
3. Set SMTP_USER to the address you own and SMTP_PASS to the generated app password in the ignored apps/backend/.env. Never commit or paste passwords into chat.
4. Keep EMAIL_PROVIDER=smtp and set APP_PUBLIC_URL to the public HTTPS app URL when deploying. Localhost is valid only for local testing; recipients on other devices cannot open your localhost links.
5. After checking credentials, set EMAIL_NOTIFICATIONS_ENABLED=true and restart the backend. Keep it false until setup is complete. The From display name is FoodRescue, with the actual authenticated Gmail address. It does not impersonate an address you do not own.

Gmail transport uses smtp.gmail.com port 465, authenticated TLS with certificate verification. Local development uses a background worker. Vercel uses a protected POST /api/internal/email-dispatch endpoint invoked each minute by Supabase Cron; deployment URL and its shared secret live in Supabase Vault. ChatGPT's Gmail connector does not provide credentials to this server.

## Delivery and recovery

The Supabase email_outbox is server-only. Database triggers enqueue future claim changes and new food listings transactionally; a service-role worker leases two jobs every 15 seconds. Failed connections before SMTP delivery can retry, up to five attempts. SMTP has no exactly-once delivery guarantee: interruptions after a send starts are marked uncertain and are not automatically replayed, avoiding blind duplicate sends. Operators must review uncertain/failed jobs; sent means the mail server accepted the message, not that it reached the inbox. There is no delivery webhook or bounce dashboard yet.

Jobs expire after 20 hours. Completed delivery records are purged after 30 days while the worker is enabled. Resend remains an optional adapter and uses its idempotency header; Resend requires a domain you control and cannot verify gmail.com as your domain. It is not used for the selected Gmail setup.

Migration: 20261031010000_email_notifications.sql. It adds owner-isolated email_preferences, a server-only email_outbox, event triggers and service-only leasing/acknowledgement RPCs. Applied to the linked project; Gmail credentials were authenticated successfully and local delivery is enabled. The local Gmail address and any secrets exist only in the ignored backend environment, not this document.

Validation: 102 tests pass, including 12 email tests for participant details, receipts, opt-in/radius checks, cross-account isolation, verified addresses, leases, account email changes, idempotency and uncertain SMTP outcomes. Lint, backend type checks and the frontend build pass. Gmail SMTP authentication passed and Gmail accepted one setup test addressed to the authenticated sender. Inbox arrival and a real claim-to-email handover remain separate checks; no fictional pickup was created to test delivery.

## Suggested next emails

- Pickup deadline reminders for accepted, uncollected claims.
- Cancellation-request decisions and donor listing withdrawal notices.
- Donor listing-expiry reminders.
- Report-resolution updates.
- Optional daily nearby-food digest to reduce one-email-per-listing volume.
- Delivery failure and bounce alerts for operators.

App emails supplement the existing in-app notices. Authentication/security emails remain owned by Supabase Auth.
