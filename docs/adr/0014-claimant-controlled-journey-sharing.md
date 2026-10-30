# Limit journey sharing to the claimant and donor

Live journey sharing starts only when the claimant taps On my way and consents to sharing their location. Only that claim's donor may view the claimant's latest shared location. Sharing stops on pickup, approved cancellation, donor post cancellation, admin post removal, or expiration.

The claimant can stop sharing manually without cancelling their claim. We chose explicit, claim-bound sharing over continuous account-level tracking because location sharing is for coordinating one pickup.

The defense requires foreground tracking only: location updates while the app is open, with the donor shown the last update time when updates stop. Background tracking with the app closed or the phone locked is deferred.

If location permission is denied or GPS is unavailable, the claimant can still send On my way and complete QR pickup. The donor sees location unavailable or the last update time, rather than a misleading live marker. Journey sharing is optional and never a prerequisite for pickup.

Journey tracking retains only the latest shared location, not a route history. Shared coordinates are deleted when sharing ends, including when the claimant manually stops sharing. Claim and pickup timestamps remain in transaction history without retaining journey coordinates.
