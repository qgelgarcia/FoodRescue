# Require live admin moderation for the school defense

Live admin moderation is required for the school defense in addition to the shared donor and claimant workflow. Existing simulated admin screens are insufficient evidence of this requirement; required controls must operate on shared persisted data with authorization enforced server-side.

We chose this scope over deferring moderation as prototype screens because the user explicitly requires it in the defense.

The required minimum is viewing users, posts, and claims; suspending and reactivating users; removing posts with a required explanation; reviewing and resolving user-submitted reports; and recording every moderation change in an audit log. Permanent bans, broadcast announcements, and advanced analytics are deferred. Suspension and removal effects are recorded in decisions 0011 and 0012.

Any signed-in non-admin member may submit a report, including suspended members. A report targets a post or another member and requires an explanation; self-reporting is blocked. Reporters can view their own reports' status. Admins move reports through open, reviewed, and resolved states, with a required resolution explanation. Reports remain in history.
