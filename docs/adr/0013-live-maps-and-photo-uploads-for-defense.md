# Require live maps and photo uploads for the defense

The school defense requires a working map and real user photo uploads in addition to the shared claim and moderation workflows. The existing CSS campus map and local photo previews are insufficient evidence of these requirements.

We chose this scope over a text-only pickup location and preset images because the user explicitly requires maps and uploads to work live. Live claimant journey tracking is also required, rather than relying only on the manual On my way notice. The following details and decision 0014 record the resolved interactions and boundaries.

Each post supports one optional photo, limited to 5 MB and JPEG, PNG, or WebP, uploaded to Supabase Storage. Upload failures must produce clear feedback, and posts without a photo use a default image. Photo editing is locked after the first claim, along with the other post details. Journey sharing boundaries and foreground-only behavior are recorded in decision 0014.

Donors manually place a pickup pin on the interactive map and enter an address and pickup instructions. Claimants can view the pickup pin even when their own location permission is denied or unavailable. Unavailable claimant GPS does not block pickup.
