# FoodRescue

FoodRescue connects campus members sharing surplus food with members requesting portions for pickup.

## Language

**Donor**:
The campus member who offers food and approves claims against that offering.

**Claimant**:
The campus member requesting portions from a donor's food offering.

**Pending claim**:
A request awaiting donor approval that immediately reserves its requested portions. It does not yet authorize pickup.
_Avoid_: Ready for pickup

**Accepted claim**:
A claim approved by the donor and ready for pickup before the pickup deadline.

**Available portions**:
Portions that remain open to new claims, excluding portions reserved by pending or accepted claims.
_Avoid_: Uncollected portions

**Fully reserved post**:
A post with no portions currently available for new claims. It may reopen when a reservation is released before its deadline, provided the donor has not cancelled it and an admin has not removed it.
_Avoid_: Fully picked up

**Released reservation**:
Portions freed by donor rejection or an effective claim cancellation. They become available again before the deadline unless the post has been cancelled or removed, reopening a fully reserved post when necessary.

**Pickup deadline**:
The strict end of a post's pickup window, after which new claims and pickup confirmation are unavailable. It is not a guarantee of food safety.

**Expired claim**:
An accepted claim that was not collected before the pickup deadline. It remains in history and does not count as redistributed food.

**Rejected claim**:
A pending request declined by the donor or automatically rejected when the pickup deadline passes.

**Pickup QR code**:
A code presented by the claimant and scanned by the donor to identify an accepted claim for pickup confirmation. It contains an opaque token rather than personal or food details.

**Picked-up claim**:
An accepted claim whose entire reserved quantity has been handed over and confirmed by its donor before the pickup deadline.

**Cancellation request**:
A claimant's explained request for the donor to approve cancellation of a pending or accepted claim. The reservation remains held while the request awaits a decision.

**Denied cancellation**:
A cancellation request refused by the donor, leaving the claim in its existing pending or accepted state. An accepted claim's pickup QR remains valid until the pickup deadline.

**Approved cancellation**:
A cancellation request granted by the donor, ending the claim and invalidating its pickup QR. Its portions become available again only before the deadline while the post remains available.

**Cancelled post**:
A food offering withdrawn by its donor with a required explanation, including when reservations already exist. It is closed to new claims and pickup confirmation.

**Cancelled claim**:
A claim ended by donor approval of the claimant's cancellation request or by donor cancellation of its post. It remains in history and does not count as redistributed food.

**Claim eligibility**:
A member may have at most one pending or accepted claim on a given post. Once that member has picked up a claim from the post, they may not claim from it again.
A rejected or cancelled claimant may submit a new request while portions remain available before the deadline; earlier claims remain in history.

**Pickup departure notice**:
A claimant's optional, one-time notice that they are on their way to collect an accepted, unexpired claim. It informs the donor without changing the claim to picked up.
_Avoid_: Invoice

**Suspended member**:
A member barred from creating posts or submitting new claims who can still log in, view history, and complete existing pickup arrangements.

**Removed post**:
A food offering closed by an admin with a required explanation. Its outstanding pickups are stopped, while completed pickups remain in history.

**Reporter**:
A signed-in non-admin member who submits a report. Suspended members remain eligible to report.

**Report**:
A member's explained complaint about a post or another member, tracked as open, reviewed, or resolved. Reporters may view their own reports and cannot report themselves.

**Resolved report**:
A report whose admin review has concluded with a recorded resolution explanation. The report remains in history.

**Journey sharing**:
A claimant's consented sharing of their latest location with their claim's donor, started through On my way. Sharing ends on pickup, effective cancellation, post removal, expiration, or the claimant manually stopping it; stopping sharing does not cancel the claim.
