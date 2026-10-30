# Verify pickup with a single-use QR token

The claimant presents a QR code containing an opaque pickup token, with no name, phone number, or food details. The donor scans it to confirm pickup. Before confirmation, the server validates the authenticated donor's ownership of the post, the accepted claim, the strict pickup deadline, and the token's single use.

This is pickup verification, not end-to-end encryption; the server remains able to validate the claim. We chose QR verification over a manually matched pickup code for the school-defense workflow. Pickup confirmation records the entire claimed quantity, and repeated token use must not confirm or count another pickup. Partial pickup remains outside the agreed core flow.

A single-use pickup code is shown alongside the QR as a fallback when scanning fails. The donor may enter this code manually; the server applies the same ownership, accepted-claim, deadline, and single-use checks. QR scanning remains the primary flow, and either successful verification consumes the same pickup authorization.
