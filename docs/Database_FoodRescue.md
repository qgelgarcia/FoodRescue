# FoodRescue — Database Design

This document describes required target changes, not runnable SQL or the deployed schema. Existing migrations are under supabase/migrations; they do not yet implement the full [Design Agreement](Design_Agreement_FoodRescue.md). Do not copy the former illustrative schema/RLS/RPC as an exact build contract.

## Required entities
| Entity | Required data and behavior |
|---|---|
| profiles | Auth-linked identity, name, phone, public role, avatar, active/suspended status; prevent member role/status escalation |
| food_posts | Donor, food details, total/available quantity, optional photo, pickup coordinates/address/instructions, deadline, lifecycle, explained cancellation/removal |
| claims | Post, claimant, positive quantity, lifecycle, timestamps, closure reason; retained history |
| cancellation requests | Claim, claimant explanation, awaiting/approved/denied decision, donor decision metadata; separate from pending/accepted claim state |
| pickup authorization | Claim-bound opaque QR token and manual fallback verification, single-use consumption and invalidation; never expose raw secrets broadly |
| departure notice | Claim-bound once-only On my way timestamp |
| journey location | Claim's latest consented coordinates/update time only; donor-only read, deletion when sharing ends |
| notifications | Recipient, event, related entity, message/read state; persisted shared inbox |
| reports | Reporter, post/user target, explanation, open/reviewed/resolved, resolution explanation and admin metadata |
| admin_logs | Actor, action, target, timestamp, applicable explanation; recorded atomically with moderation |

Exact table/column names for new entities are implementation choices. Do not treat this table as a migration already applied.

## Lifecycle
- Post: active, fully reserved, expired, donor-cancelled, admin-removed. Existing fully_claimed may represent fully reserved; it must not imply pickup.
- Claim: pending, accepted, rejected, picked_up, cancelled, expired. Existing schema lacks expired.
- Cancellation request decision is independent of claim state; denial does not turn an accepted claim back into pending.
- Preserve completed claims and report history. Existing cascade-delete behavior needs review before claiming permanent audit retention.

## Constraints and transactional operations
- Positive whole-number quantities; available inventory between zero and total.
- Serialize reservation/release against the post and validate eligibility and server time.
- Enforce one pending/accepted claim per member/post, including requests awaiting cancellation approval, and block any subsequent claim after that person's pickup.
- Release inventory at most once. Reopen fully reserved posts only before deadline and when not cancelled/removed.
- Lock donor-editable details after any first claim, including terminal claims.
- Validate donor ownership and claim state for acceptance, rejection, cancellation decisions, and pickup.
- QR/manual pickup consume the same authorization once, verify before deadline, and atomically mark picked_up. Do not let client-generated local IDs represent canonical claims.
- Deadline processing includes active and fully reserved posts, rejects pending claims, expires uncollected accepted claims, invalidates authorizations, and removes journey coordinates.
- Donor cancellation/admin removal close outstanding claims without reopening the post. Preserve picked_up claims.
- Persist moderation, audit, relevant notifications, and lifecycle changes together.

## Access requirements
Members read their own profile, posts, claims, notifications, and reports. Claim participants can read necessary related post details after closure. Expose only needed donor identity information, not unrestricted phone/profile data.

Active unexpired public discovery is separate from owner/participant history access. Suspension restricts new posting/claiming but not existing arrangements or reporting. Admin operations require server-validated role and audit recording.

Journey locations are readable only by the claim's donor and writable only by its consented claimant during an eligible journey. Delete coordinates on sharing closure, including deadline cleanup if the client disappears.

Protect inventory, lifecycle, role/status, tokens, reports' resolution fields, and audit writes with validated operations and column privileges as appropriate; row policies alone are insufficient.

## Storage and scheduled work
Use food-photos for one optional JPEG/PNG/WebP up to 5 MB, with donor ownership and type/size enforcement. Scheduled expiration persists terminal states; it is not the sole deadline gate. Feed and RPC timestamp checks must hold between runs.

SMS provider integration is deferred. Future Edge Functions must keep provider credentials server-side and validate event/recipient authorization; never expose the provider key in the APK.
