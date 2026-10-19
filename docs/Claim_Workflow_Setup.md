# Donor decisions, cancellations and pickup verification

## Use the running app

Open `http://127.0.0.1:5173/app/history` with two separate signed-in accounts/browser profiles.

1. A member requests portions from another member's live listing. The request is **pending** and reserves those portions immediately. It has no usable pickup pass yet.
2. The listing owner opens **Claims → Donor Requests** and accepts or rejects the claim. Rejection releases the reservation once; acceptance makes the pickup QR/manual code available in the claimant's **My Claims** tab.
3. At handover, the donor opens **Donor Requests → Verify a pickup**. Scan the claimant's QR, or enter the full code printed below it, then confirm. Both use the same opaque, single-use authorization. Only the listing's donor can confirm the complete quantity of an accepted claim before the deadline.
4. A claimant can request cancellation of a pending or accepted claim with a 10–2,000-character explanation. Portions remain reserved until the donor approves. The donor approves or denies from the request card. Approval ends the claim and invalidates its code; denial preserves the claim and any accepted pickup authorization.

Pickup is blocked for the particular claim while its cancellation awaits a decision. Other claims can still be picked up. Claimants cannot confirm their own pickups. Suspended members can finish existing arrangements but cannot create new claims. A rejected/cancelled claimant can request again before the deadline if portions are available; a picked-up claimant cannot.

Camera scanning starts only when **Scan QR code** is selected. If camera access is denied or unsupported, use manual entry. Camera streams stop when the scanner closes, its tab is hidden, or a token is found. QR images are generated inside the app; tokens are not sent to an external QR service. The manual code is the same UUID as the QR payload, not an older `FR-1234` demo pass.

The claims screen refreshes after actions, when the tab gains focus, and every 15 seconds while visible. **Refresh** requests an immediate update.

## Database setup

The required migration is `supabase/migrations/20261022000000_claim_decisions_and_pickup.sql`, after the repository's earlier migrations. It was applied to the shared project during this implementation, together with the pending October 21 donor-archive prerequisite.

For another linked checkout, the standard Supabase migration workflow can apply these files. The narrowly scoped helper `node scripts/apply-claim-migration.mjs` lists pending versions without applying them. Add `--apply` only when authorized to change that database. It permits only the October 21 prerequisite and October 22 workflow migration and uses one transaction.

The helper reads the linked pooler URL in `supabase/.temp/pooler-url`, `DB_PASSWORD` from the ignored `apps/backend/.env`, and a trusted Supabase CA at `supabase/.temp/prod-ca-2021.crt` (or `DB_SSL_CA` in the backend environment file). Obtain the certificate from Supabase's Database Settings; TLS certificate verification stays enabled. Do not commit credentials or disable TLS verification. See [Supabase SSL guidance](https://supabase.com/docs/guides/platform/ssl-enforcement).

## Tests and scope

Implementation verification: all **26 automated tests passed**, the production build passed, and all **five database workflow tests passed against shared Supabase** with fixtures rolled back. The restarted claims page, admin page and backend health endpoint returned HTTP 200. The claims tabs were inspected in the browser; physical camera scanning was not exercised.

- `npm test` runs input validation and the actual SQL migrations/workflow regressions in isolated PGlite PostgreSQL, including authenticated/anonymous database roles and RLS.
- The database suite covers ownership, membership, deadlines, overselling, repeated claims, pending/accepted transitions, rejection/release-once, cancellation hold/deny/approve, token privacy, wrong-donor/claimant rejection, legacy RPC bypass prevention, replay, and admin removal.
- An optional shared-database check uses `$env:CLAIM_WORKFLOW_REMOTE='1'; node --test scripts/claim-workflow.test.mjs` in PowerShell. It requires the same ignored database connection files. Test fixtures stay inside a transaction that rolls back; the mode never bootstraps/replaces shared schemas or applies migrations. Remove that environment variable afterward. Normal `npm test` uses an isolated database.
- `npm run build` compiles shared types, Express and the frontend.

The migration blocks claims/pickups at the server deadline. Claim history displays late pending/accepted claims as rejected/expired. It does not add a scheduled expiration worker or claim that Android camera behavior was physically tested.

Listing details lock after the first claim, and direct archive after claim history is rejected. A separate explained donor post-cancellation flow is still outside this change; approving an individual claim cancellation is implemented here. This prevents post edits/archive from bypassing the new claim rules.
