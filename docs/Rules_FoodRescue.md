# FoodRescue — Rules

Confirmed target rules; existing migrations and UI do not yet enforce every rule. [Design Agreement](Design_Agreement_FoodRescue.md) and the root glossary define the agreed terminology.

## Posts and reservations
- Positive integer portions; required food name, pickup pin/address/instructions, and future deadline.
- Only the owning donor may edit or cancel a post, except authorized admin removal.
- After the first claim, food details, quantity, location, deadline, and photo stay locked even if the claim later ends.
- A member cannot claim their own post or submit new claims while suspended.
- Submission immediately reserves portions in one atomic transaction; never oversell.
- At most one pending/accepted claim per member per post; completed pickup blocks another claim. Rejected/cancelled claims permit a new eligible request.
- Zero available portions means fully reserved, not necessarily collected. Release a reservation once; reopen before the deadline unless cancelled/removed.

## Claim transitions
| Event | Result |
|---|---|
| Donor accepts pending claim | accepted; pickup authorization becomes available |
| Donor rejects pending claim | rejected; release reservation once |
| Claimant requests cancellation | keep pending/accepted state and reservation; explanation required |
| Donor approves cancellation | cancelled; release once if post can reopen; invalidate pickup authorization |
| Donor denies cancellation | preserve prior state and accepted pickup authorization |
| Donor verifies pickup | accepted → picked_up; consume authorization once; whole quantity only |
| Deadline arrives | pending → rejected; accepted → expired |
| Donor cancels post / admin removes post | pending → rejected; accepted → cancelled; invalidate authorization |

Cancellation approval, rejection, and pickup must serialize conflicting actions so only one valid result commits. Pending cancellation requests must not leave reservations stranded after terminal closure.

## Deadlines and closure
- At or after the deadline, reject new claims and pickup confirmation on the server, regardless of scheduled job timing or stale status.
- Hide past-deadline posts from discovery immediately. Scheduled processing persists final states and notifications, including fully reserved posts.
- Never extend or shorten the deadline after a first claim.
- Explained donor cancellation closes the post. Explained admin removal also closes it and audits the action.
- Preserve claims and reports in history; completed pickups remain unchanged. Uncollected expired/cancelled claims are not redistributed food.

## Pickup and location
- QR contains an opaque token, not personal/food details. It is verification, not end-to-end encryption.
- QR and manual fallback verify the same authorization: current donor owns post, claim accepted, deadline not reached, post not closed, authorization unused.
- Claimants cannot self-confirm pickup; scans/retries cannot double-count it.
- On my way is optional and once per accepted unexpired claim.
- Journey sharing requires consent, is donor-only, and foreground-only. Denial/unavailable GPS never blocks pickup.
- Keep latest location only; show freshness; delete coordinates on manual stop, pickup, effective cancellation, removal, or expiration.

## Moderation, reports, and security
- Admin accounts are not publicly self-registrable.
- Suspension blocks new posts/claims but preserves existing arrangements. Reactivation removes the restriction.
- Post removal requires an explanation, rejection/cancellation of outstanding claims, invalidation of tokens, affected-member in-app notifications, and an audit record.
- Any signed-in non-admin, including suspended members, may report posts/other members with an explanation; self-reporting blocked.
- Own report status is visible to its reporter. Admins review then resolve with an explanation; do not delete reports.
- Audit every moderation change with actor, action, target, and timestamp; record applicable explanations.
- Enforce authorization in database policies and validated server operations. RLS alone does not restrict writable columns or enforce lifecycle transitions.
- Do not expose phone numbers or journey coordinates through broad profile/map reads; journey access belongs only to the specified donor.
- Direct client inventory, claim-state, role/status, pickup-token, and audit mutations must not bypass validated operations.
- One optional JPEG/PNG/WebP photo, maximum 5 MB, with ownership-based upload enforcement.
- SMS setup is deferred. If sending fails when later enabled, notify in-app and preserve the underlying action.
