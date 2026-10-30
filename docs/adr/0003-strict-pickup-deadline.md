# Enforce a strict pickup deadline

The post's pickup deadline is a strict cutoff: at or after that instant, new claims and pickup confirmation are blocked. Pending claims are automatically rejected; accepted but uncollected claims become expired. All claims remain in history, and expired claims do not count as redistributed food.

We chose this rule over allowing donor-confirmed late pickups to provide an unambiguous pickup window. The deadline does not guarantee food safety. This requires an expired claim status and deadline enforcement at the operation boundary; a scheduled status update alone cannot enforce the cutoff between job runs. The rule also applies to fully reserved posts.
