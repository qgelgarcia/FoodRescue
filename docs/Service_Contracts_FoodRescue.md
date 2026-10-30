# FoodRescue service contracts

Implementation baseline: 29 October 2026. Existing operations remain the authority; all IDs are database UUIDs. Client services use the signed-in Supabase session and never a service-role credential.

## States and ownership

Posts: `active`, `fully_claimed` (fully reserved), `expired`, `removed_by_donor` (explained cancellation), `removed_by_admin`. `cancellation_reason` holds the donor explanation. Details lock permanently after the first claim. The current address field includes pickup instructions; coordinates are `pickup_lat` and `pickup_lng`.

Claims: `pending`, `accepted`, `rejected`, `picked_up`, `cancelled`, `expired`. Pending/accepted quantities are reserved. Rejection/approved claim cancellation releases once only while the post is open and before its deadline. Picked-up quantities are the only redistribution metric. Post cancellation/removal never reopens inventory.

Cancellation requests: `pending`, `approved`, `denied`, `obsolete`. Asking does not release inventory. Pending cancellation prevents pickup until a decision. Denial preserves the accepted pass; approval invalidates it.

Database operations serialize changes by locking the post, then claim, then dependent request/authorization/location records. All eligibility and deadlines use server time. Suspended members can finish existing arrangements; new posts/claims require active membership.

## Operation interfaces

| Operation | Inputs | Result and authorization |
|---|---|---|
| `claim_food` | `post_id`, `claimant_id`, `qty` | Canonical `claim_id`; authenticated active claimant, not donor, eligible and sufficient portions before deadline. |
| `decide_food_claim` | `p_claim_id`, `p_accept`, `p_reason` | Donor accepts/rejects a pending claim; acceptance creates its single-use pickup authorization. |
| `request_claim_cancellation` | `p_claim_id`, `p_reason` | Claimant creates explained request (10–2,000 characters). |
| `decide_claim_cancellation` | `p_request_id`, `p_approve`, `p_reason` | Owning donor approves/denies; atomic release/invalidation on approval. |
| `verify_food_pickup` | `p_pickup_code` | Owning donor verifies an accepted unexpired claim; one full-quantity pickup, same code for QR/manual entry. |
| `cancel_food_post` | `p_post_id`, `p_reason` | Void; owner closes post with 10–2,000-character reason. Repeat of completed cancellation has no repeated effects. |
| `expire_food_posts` | none | Number of posts expired; service role/scheduled worker only, never a member client. |
| `get_my_food_claims` | none | Claimant-only history, latest cancellation decision, usable pass only where eligible, departure time and saved pickup coordinates. |
| `get_donor_food_claims` | none | Donor-owned claim history and latest cancellation decision/departure time; never pickup codes. |
| `claim_on_my_way` | `p_claim_id` | Boolean: true first time, false if already sent; only claimant of an accepted open unexpired claim. |
| `start_claim_journey_sharing` | `p_claim_id` | New session UUID after departure and explicit client consent. Existing session is replaced; only claimant can call. |
| `publish_claim_journey_location` | `p_claim_id`, `p_share_token`, `p_sequence`, `p_lat`, `p_lng` | Boolean; updates latest point only for matching session and increasing positive sequence. Cannot recreate a stopped/terminal journey. |
| `stop_claim_journey_sharing` | `p_claim_id`, optional `p_share_token` | Void; claimant deletes coordinates. Token-specific cleanup cannot delete a newer sharing session. No claim cancellation. |
| `my_claim_journey_sharing_active` | `p_claim_id` | Boolean sharing status for claimant only; no coordinates/token returned. |

Failures are thrown by Supabase and mapped through the existing `ClaimWorkflowError`/`claimRequestError` helpers for workflow actions. No new stable machine-readable error-code contract is claimed. Refresh after a conflict or uncertain response before repeating an operation; do not fabricate success.

## Posting and photos

`createFoodPost` accepts food name, description, category, integer quantity 1–100, address/instructions, `{ lat, lng }` pickup pin, pickup duration, and optional File. `updateFoodPost` additionally identifies the owner's post; the server enforces locks. Photo upload is JPEG/PNG/WebP, 5 MB maximum, under `food-photos/<owner>/<post>/<random>.<extension>`. A browser preview URL never becomes a persisted photo URL. Failed saves reconcile the stored post reference before removing a newly uploaded photo.

## Notifications and refresh

Persisted rows use `id`, `user_id`, `type`, `related_post_id`, `message`, `is_read`, `created_at`. Reads/mark-read are scoped to the recipient. Existing claim/moderation operations and new cancellation/expiry/departure/pickup transitions write notifications transactionally. Legacy lifecycle notices currently reuse `moderation_update`; departure uses `on_my_way`. These are in-app notices, not SMS or push notifications.

`foodrescue:claim_updated`, `foodrescue:post_updated` and `foodrescue:profile_updated` are same-browser refresh hints, not cross-account delivery. Visible member views also poll every 15 seconds and refresh on focus; SQL state remains authoritative.

October 30 notification update: the member header is mounted once outside route animations. Notification reads return the recent dropdown items plus a full recipient-scoped unread count; the badge is hidden when that count is zero. Read all persists read state for the recipient's unread snapshot, retaining later arrivals as unread. Realtime recipient subscriptions trigger a fresh read, with visible-page polling and focus refresh as fallback; the deployment must enable notification-table Postgres Changes replication for realtime delivery.

## Journey privacy and terminal effects

`claim_journeys` contains only one current point/time and a private publishing session/sequence. The particular donor can select only `claim_id`, `lat`, `lng`, `updated_at`; the claimant receives only its own session through RPC, not a coordinate read endpoint. Unrelated members/admins are denied. Foreground device collection stops on leaving/hiding the sharing view; paused points are labelled stale after two minutes.

Manual stop deletes the point. Claim terminal transitions delete it in the same transaction as pickup, approved cancellation, donor cancellation, admin removal or expiration. Server reads/updates stop at the deadline even before the scheduled cleanup physically deletes a due point. The worker must be enabled for eventual expiration cleanup.

## Profile and metrics

`updateOwnProfile({ fullName, phone })` writes only trimmed `full_name` and optional international `phone` to the signed-in profile. Existing owner RLS and moderation-field guards remain active. Profile metrics exclude sample records and sum portions from donor-confirmed `picked_up` claims; no unsupported environmental conversion or invented achievement is displayed.
