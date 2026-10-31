# Versioned pre-entry terms and privacy notice

Current version: 2026-10-31.1.

AuthGuard and RoleGuard render TermsGate before any member/admin page for accounts without a saved acceptance for the current version. This covers email/password sign-in, Google OAuth and newly provisioned accounts. Existing accounts see it once when they have not accepted this version. Acceptance is not inferred from creating an account, logging in or previously using the app.

The notice explains verified account-email use, counterpart pickup details, optional nearby location alerts and journey sharing, Supabase data storage, Vercel hosting, public listing photos/pins, report review, AI processing through OpenRouter, zero-retention routing availability, saved chats, general nutrition limitations and safe account/community use. It describes implemented product behavior rather than claiming legal compliance or absolute security.

The agreement checkbox starts unchecked and is required. A separate, initially unchecked choice enables claim and receipt notification emails; users may continue without it. Nearby-food email alerts remain a separate Profile setting. Not now signs the account out without accepting. This is a full page with visible sections, keyboard controls, error recovery, and no navigation to the main app until saving succeeds.

Migration 20261031040000_terms_acceptance.sql adds owner-readable, server-written acceptance records. The acceptance RPC accepts only the current version and derives the user ID from auth.uid(). Acceptance time comes from the database. Repeated acceptance does not overwrite email preferences changed later. The email leasing RPC excludes recipients who have not accepted; its previous unrestricted implementation is no longer callable by the service role. Previously leased in-flight deliveries cannot be retracted.

No browser local-storage acceptance flag is trusted. Checking acceptance or saving can fail; both fail closed with retry/sign-out options. Account change listeners clear the prior profile and acceptance boundary. Automated tests use fixtures and do not accept a binding agreement for any real account.

For a future notice version, update the UI/service version and add a migration updating the server acceptance/delivery rules. Do not rewrite applied migration history. Affected users must review the new version on their next entry.

The email-settings action row now uses a scoped div instead of the shared global footer element, removing the inherited pale background and fixed sizing that made text unreadable in dark mode.
