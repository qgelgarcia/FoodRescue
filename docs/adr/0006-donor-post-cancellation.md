# Allow explained donor cancellation of reserved posts

A donor may cancel an entire post even when pending or accepted claims exist, but must provide an explanation. Cancellation immediately stops new claims, rejects pending claims, cancels accepted claims, and invalidates their pickup tokens. Affected claimants must be shown the explanation. Already picked-up claims remain unchanged in history.

We chose this exception to preserving pickup arrangements because donors must be able to withdraw food that is no longer available or suitable to share. Cancellation closes the post rather than making released reservations available again. The post model needs an explicit cancelled state; cancellation must not be represented as expiration or admin removal.
