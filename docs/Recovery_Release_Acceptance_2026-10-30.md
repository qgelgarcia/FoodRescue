# Recovery setup and acceptance

The source and local Supabase configuration include these exact callbacks. Local `supabase/config.toml` does not update the linked hosted project's Auth settings.

In the linked project's [Auth URL configuration](https://supabase.com/dashboard/project/tbmmqimhhazbuazetdwa/auth/url-configuration), retain existing approved entries and add:

```text
http://127.0.0.1:5175/login
http://localhost:5175/login
http://127.0.0.1:5175/reset-password
http://localhost:5175/reset-password
org.foodrescue.campus://auth/callback
org.foodrescue.campus://auth/recovery
```

Keep the existing hosted Site URL until a deployment origin is selected. Add only the selected HTTPS origin's `/login` and `/reset-password` when hosting is authorized. Do not add arbitrary production wildcard redirects. Hosted configuration has not been verified: this session has no Supabase management API credential or browser-control tool. Database migration access does not provide Auth configuration access.

## Designated test account workflow

Use accounts intended for acceptance; do not change a real member's password as an automated smoke test. The account owner enters and submits passwords.

| Check | Expected | Recorded result |
| --- | --- | --- |
| Request recovery for an existing test email | Generic confirmation; email arrives with intended redirect | Pending real email |
| Request for an unknown address | Same confirmation; no account disclosure | Mocked contract passes; live pending |
| Open latest web recovery link | Password form enabled only for recovery session; callback tokens removed from visible URL | Mocked tracking passes; live pending |
| Switch to email/password manager and return | Same recovery session remains authorized | Regression test passes; live pending |
| Submit matching valid new password | Success; new password can sign in | Pending account owner |
| Reuse/expire recovery link | No password update; request-new-link action available | Error mapping tested; live pending |
| Open reset screen in ordinary signed-in session | Recovery form remains unavailable | Previously browser-verified; regression contract passes |
| Android cold/warm recovery callback | Dedicated recovery screen, never home feed | Exact callback tests pass; physical device pending |
| Google callback | Existing login callback remains separate | Callback tests pass; real provider/device pending |
| Offline or throttled request | Useful failure, no false sent-email claim | Mocked contract passes; live pending |

Do not capture reset tokens, pickup codes or passwords in screenshots/logs. Record device/browser/build, timestamp and actual pass/fail in `Defense_Test_Record.md`. This checklist does not certify email delivery, dashboard settings or physical-device behavior.
