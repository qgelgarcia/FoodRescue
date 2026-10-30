# FoodRescue design interview agreement

Status: Shared understanding confirmed by the user; original design documents reconciled. This records the interview outcome, not evidence of implementation or deployment.

## Delivery and required scope

- School defense with a real shared Supabase workflow across separate donor, claimant, and admin accounts.
- Android APK for donor and claimant experiences; desktop browser for the admin panel.
- Live posting, claim management, pickup verification, cancellation, expiration, shared history, and in-app notifications.
- Interactive pickup map, real photo uploads, and foreground claimant journey sharing.
- Live admin moderation, reports, and audit logs.
- SMS integration for acceptance and On my way remains intended, but provider selection and SMS work are deferred for now. Philippine recipients are the target. Do not claim live SMS as implemented or verified.

## Claims and inventory

- Submission creates a pending claim and immediately reserves its portions; donor acceptance makes it ready for pickup.
- One pending or accepted claim per member per post; no repeat claim after pickup. Rejected or cancelled claimants may retry before the deadline while portions remain available.
- Rejection or approved cancellation releases a reservation once. A fully reserved post reopens when portions are released before its deadline, unless cancelled or removed.
- Pending and accepted claim cancellations require the claimant's explanation and donor approval. Reservations stay held while awaiting a decision. Denial preserves the prior claim state and any valid pickup authorization.
- Donors may cancel posts with a required explanation: reject pending claims, cancel accepted claims, invalidate pickup authorization, and show affected claimants the explanation. Completed pickups remain unchanged.
- Food details, quantity, pickup location, deadline, and photo lock after the first claim, even if it later ends. Changed arrangements require explained post cancellation and a new post.
- At or after the deadline, block new claims and pickup confirmation; reject pending claims and expire accepted but uncollected claims. Preserve history and count only confirmed pickups as redistributed food.

## Pickup

- Donor scans the claimant's opaque QR token, which contains no personal or food details. This is verification, not end-to-end encryption.
- Validate donor ownership, accepted claim, deadline, and single use on the server. Confirm the whole claim quantity.
- A single-use manual pickup code provides a scanning fallback with the same checks and consumes the same authorization.
- On my way is optional, allowed once per accepted unexpired claim, and does not confirm pickup.
- Intended SMS events: acceptance to the claimant, and On my way to the donor. Catch SMS failures and use an in-app notification without undoing the action. Automatic SMS retries were not agreed.

## Maps, journey sharing, and photos

- Donor manually places a pickup pin on an interactive map and supplies an address and instructions; claimant can view the pin without GPS permission.
- Journey sharing begins through On my way with explicit claimant consent. Only that claim's donor sees the latest location.
- Foreground updates only; show unavailable or last-updated status when location is missing or stale. Background tracking is deferred.
- Stop sharing on pickup, effective cancellation, post removal, expiration, or manual stop. Manual stop does not cancel the claim.
- Keep only the latest coordinates and delete them when sharing ends; retain no route history. Claim and pickup timestamps remain in history.
- GPS denial does not prevent On my way or QR pickup.
- One optional JPEG, PNG, or WebP photo per post, up to 5 MB, uploaded to Supabase Storage. Show upload failures clearly; use a default image when absent.

## Moderation and reports

- Admins view users, posts, and claims; suspend/reactivate users; remove posts with explanations; review/resolve reports; and audit every moderation change.
- Suspension blocks new posts and claims but permits login, history, and completion of existing arrangements.
- Admin removal rejects pending claims, cancels accepted claims, invalidates pickup authorization, notifies the donor and affected claimants in-app, and records an audit entry. Preserve completed pickups.
- All signed-in non-admin members, including suspended members, can report posts or other members with an explanation. Block self-reporting. Reporters see their own report status.
- Reports progress through open, reviewed, and resolved; resolution requires an admin explanation. Preserve reports in history.
- Permanent bans, broadcasts, and advanced analytics are deferred.

## Documentation reconciliation

The confirmed interview decisions revise conflicting original rules. In particular: cancellations require donor approval in both pending and accepted states; deadlines cannot be shortened after the first claim; claim expiration and donor post cancellation need explicit states; fully reserved posts can reopen; pickup must be donor-verified rather than locally self-completed; live maps, uploads, foreground tracking, and admin moderation are required; SMS setup is deferred.

The glossary is in CONTEXT.md, and decisions are in docs/adr/. The specs, rules, database design, system design, architecture, phases, build prompt, and walkthrough have been reconciled against this agreement. The rubric audit and code walkthrough retain current implementation evidence, with explicit gaps against this confirmed target.
