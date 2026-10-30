# Git and Supabase deployment — 30 October 2026

The user explicitly authorized committing/pushing the implementation and applying it to Supabase, replacing the earlier deployment-files-only restriction for these actions. Website hosting publication was not requested.

## Supabase result

Linked project: `tbmmqimhhazbuazetdwa`.

Applied in one transaction with verified TLS and recorded in the migration ledger:

- `20261029010000_post_photos_and_pickup_constraints.sql`
- `20261029020000_post_cancellation_and_expiration.sql`
- `20261029030000_claimant_journey_sharing.sql`
- `20261030010000_enable_notification_realtime.sql`

Preflight found no existing coordinate or notification-type violations. Post-deployment inspection reports no pending repository migrations. Donor cancellation, expiration, departure and journey operations are installed; the photo bucket limits and notification Realtime publication are verified.

Supabase Cron is enabled. `foodrescue-expire-posts` is active every minute, and its latest inspected execution succeeded at 09:28 Asia/Taipei on 30 October. The worker enforces the already agreed deadline behavior for due listings.

The reproducible, allow-listed deployment helper is `scripts/apply-feature-migrations.mjs`. Its default mode is read-only; `--apply` changes the linked database. No credentials are included in this record or committed configuration.

## Verification and limits

- All 37 local automated tests passed, including migrations in isolated PostgreSQL/PGlite and notification read-state tests.
- Shared/backend/frontend production builds passed; Vite retains the existing large-chunk advisory.
- Staged credential checks passed before commit preparation.
- The optional rollback-only remote workflow test was started, but its final output was unavailable after the session changed. No remote-suite pass is claimed. The connection's outer transaction is not an acceptance substitute for real-device testing.
- Physical camera/GPS, two-phone acceptance, auth-provider redirect configuration and hosting remain separate release checks.

## Git scope

Implementation source, tests, Android project, migrations and supporting design/release/planning documents are included. Existing unrelated `.vibe-wise` notes, the learning-guide edits, credential/environment examples and generated output documents/screenshots are left outside the commit. Git push completion and the resulting commit are reported in chat after remote verification.
