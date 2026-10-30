# FoodRescue release preparation

Prepared 29 October 2026; updated 30 October 2026. The later user request authorized Git push and Supabase deployment. The four feature migrations are now applied to the linked project; see Deployment_2026-10-30.md. Website hosting has not been published.

## Database

Apply repository migrations in timestamp order using the team's normal Supabase migration workflow after reviewing the target project and taking the team's normal backup precautions. The new migrations are:

1. `20261029010000_post_photos_and_pickup_constraints.sql` — Storage limits/ownership and coordinate validation.
2. `20261029020000_post_cancellation_and_expiration.sql` — explained donor cancellation, pickup notices and expiration processing.
3. `20261029030000_claimant_journey_sharing.sql` — departure and private latest-location sharing with terminal cleanup.
4. `20261030010000_enable_notification_realtime.sql` — adds notifications to Supabase's existing Realtime publication, preserving recipient RLS.

Do not use the older `apply-claim-migration.mjs --apply` helper for these: its allow-list intentionally covers only the earlier claim package. Its read-only default can list pending migrations.

For this feature package, `node scripts/apply-feature-migrations.mjs` performs a read-only preflight and verification. The explicit `--apply` mode applies only these four allow-listed migrations in one transaction with verified TLS, records their versions, enables available Supabase Cron and schedules expiration. This mode changes the linked database and should be used only for an authorized deployment. Credentials remain in ignored local files.

The expiry migration schedules `foodrescue-expire-posts` once per minute if pg_cron is already enabled. Before acceptance, enable Supabase Cron in the target project if absent and schedule `select public.expire_food_posts();` once per minute. Confirm the named job and its successful run history. Server deadline checks remain authoritative even if cleanup is delayed. Until the worker runs, due journey rows may still be physically stored, although donor reads and updates are blocked after the deadline.

Never put a database password or service-role key in the frontend. Journey coordinates are accessible to the particular donor, not the admin panel.

## Desktop web admin

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the frontend build environment; the anon key is a public client credential protected by database authorization. Use existing ignored environment files for local builds, not committed secrets.

From the repository root:

```powershell
npm ci
npm test
npm run build
```

Deploy only `apps/frontend/dist` to a static HTTPS host. The member routes and desktop admin share this frontend. Configure a fallback to `index.html` for client routes, including `/admin/dashboard` and `/app/history`. A `_redirects` file is bundled for hosts supporting that format; `apps/frontend/vercel.json` supplies equivalent Vercel routing when that directory is the configured project root. Configure the monorepo build to install workspace dependencies from the repository root.

Set the deployed origin and allowed web auth callback URLs in Supabase Auth. Provision an admin using the existing Member5_Admin_Moderation.md instructions. Test a hard reload on an admin route and reject member access to admin RPCs. No admin password is embedded in the deployment bundle.

## Android debug APK

The committed Capacitor project uses app ID `org.foodrescue.campus`, Android SDK 36, minimum Android API 24 and Java 21. Node 22 or newer is required by Capacitor 8. Official setup reference: https://capacitorjs.com/docs/getting-started/environment-setup.

Set `JAVA_HOME` to a JDK 21 installation and `ANDROID_HOME` to the Android SDK. Install platform 36 and the matching build tools using Android SDK Manager. Use the same public frontend Supabase configuration as the desktop build.

```powershell
./scripts/build-android.ps1
```

The script builds the current web source, synchronizes Capacitor, assembles the debug variant and copies it to `output/release/FoodRescue-debug.apk`. On other systems run `npm run android:sync --workspace=@foodrescue/frontend`, then `./gradlew assembleDebug` inside `apps/frontend/android`.

Debug signing makes this APK suitable for installation/testing; it is not a signed store release. Keep any future release keystore/passwords outside source control. Never configure a production APK to load a development server.

Camera and foreground location permissions are declared; background location is not requested. Photos use the system file/camera chooser, QR uses WebView camera access with manual-code fallback, and journey sharing uses native geolocation on Android. Verify these on actual devices before claiming release acceptance.

Android Google OAuth uses the system browser and PKCE, returning through `org.foodrescue.campus://auth/callback`. Add that exact redirect URL to Supabase Auth's allowed redirects before device testing. The app handles warm and cold callback entry; it rejects callbacks for other hosts/paths and does not accept injected implicit tokens. Provider configuration and a real Google sign-in still need device acceptance. Email/password remains available for initial acceptance. See the official [Supabase native deep-link guidance](https://supabase.com/docs/guides/auth/native-mobile-deep-linking).

## October 30 account features

Password recovery requires exact Supabase Auth redirect entries for `http://127.0.0.1:5175/reset-password` during local testing, the selected HTTPS origin followed by `/reset-password`, and `org.foodrescue.campus://auth/recovery` for Android. Keep the existing Google callback entry. These dashboard settings and real recovery-email delivery have not been verified by the source tests. Do not include recovery tokens in acceptance screenshots.

Apply `20261030020000_profile_avatars.sql` after the earlier migrations. It creates the private `profile-avatars` bucket with owner-only policies and JPEG/PNG/WebP limits of 5 MB. The migration was applied to linked project `tbmmqimhhazbuazetdwa` on October 30. No service-role key belongs in the frontend.

Run `npm run lint`, `npm test`, and `npm run build` from the workspace root before packaging. ESLint checks undefined identifiers in frontend JavaScript/JSX, including JSX component names. The support contact supplied by the project owner is `FoodRescue@gmail.com`.

## Required release evidence

Complete Defense_Test_Record.md using two Android installations, separate donor/claimant accounts and a desktop admin. Record actual outcomes, device versions, build version and screenshots. Build success and isolated SQL tests do not prove physical GPS/camera behavior, hosted Cron execution or independent-connection race safety.
