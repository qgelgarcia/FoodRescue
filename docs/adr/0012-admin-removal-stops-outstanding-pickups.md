# Stop outstanding pickups when an admin removes a post

Admin post removal requires an explanation and immediately stops new claims and outstanding pickups. Pending claims are rejected, accepted claims are cancelled, and pickup tokens are invalidated. The donor and affected claimants receive in-app notifications, and the moderation action is recorded in the audit log. Already completed pickups remain unchanged in history.

We chose this behavior over preserving reservations on removed posts because moderation must be able to stop pickups from unsafe or otherwise unsuitable offerings. Removed posts remain distinct from donor-cancelled and expired posts; released reservations do not reopen them.
